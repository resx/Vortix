/* ── 远程文件编辑器（CodeMirror 6 弹窗） ── */

import { useEffect, useRef, useState, useCallback } from 'react'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, type ViewUpdate } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { oneDark } from '@codemirror/theme-one-dark'
import { AppIcon, icons } from '../icons/AppIcon'
import { getLanguageExtension, getLanguageName } from './useEditorLanguage'
import { useToastStore } from '../../stores/useToastStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { resolveFontChain } from '../../lib/fonts'

/** 根据 editorLineEnding 设置转换换行符 */
function normalizeLineEnding(text: string, lineEnding: string): string {
  // CodeMirror 内部统一使用 \n，保存时按设置转换
  switch (lineEnding) {
    case 'crlf':
      return text.replace(/\n/g, '\r\n')
    case 'cr':
      return text.replace(/\n/g, '\r')
    default: // 'lf'
      return text
  }
}

/** 根据 editorTabMode 获取 tab 大小 */
function getTabSize(tabMode: string): number {
  switch (tabMode) {
    case 'two-spaces': return 2
    case 'tab': return 4
    case 'four-spaces':
    default: return 4
  }
}

interface Props {
  filePath: string
  content: string
  onSave: (content: string) => Promise<void>
  onClose: () => void
}

export default function RemoteFileEditor({ filePath, content, onSave, onClose }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const addToast = useToastStore(s => s.addToast)
  const isDark = useSettingsStore(s => s.theme === 'dark' || (s.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches))

  const fileName = filePath.split('/').pop() || filePath
  const langName = getLanguageName(fileName)

  // 初始化编辑器（读取设置 store 中的编辑器配置）
  useEffect(() => {
    if (!editorRef.current) return

    let view: EditorView

    const setup = async () => {
      const settings = useSettingsStore.getState()
      const fontFamily = resolveFontChain(settings.editorFontFamily)
      const fontSize = settings.editorFontSize
      const wordWrap = settings.editorWordWrap
      const tabMode = settings.editorTabMode
      const ligatures = settings.fontLigatures

      const extensions = [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorState.tabSize.of(getTabSize(tabMode)),
        EditorView.updateListener.of((update: ViewUpdate) => {
          if (update.docChanged) setDirty(true)
        }),
        EditorView.theme({
          '&': { height: '100%', fontSize: `${fontSize}px` },
          '.cm-scroller': { overflow: 'auto', fontFamily },
          '.cm-content': {
            padding: '8px 0',
            fontFamily,
            fontVariantLigatures: ligatures ? 'normal' : 'none',
          },
          '.cm-gutters': { fontFamily },
        }),
      ]

      // 自动换行
      if (wordWrap) extensions.push(EditorView.lineWrapping)

      if (isDark) extensions.push(oneDark)

      const langExt = await getLanguageExtension(fileName)
      if (langExt) extensions.push(langExt)

      const state = EditorState.create({ doc: content, extensions })
      view = new EditorView({ state, parent: editorRef.current! })
      viewRef.current = view
    }

    setup()

    return () => {
      view?.destroy()
      viewRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(async () => {
    const view = viewRef.current
    if (!view) return
    setSaving(true)
    try {
      const raw = view.state.doc.toString()
      const lineEnding = useSettingsStore.getState().editorLineEnding
      const normalized = normalizeLineEnding(raw, lineEnding)
      await onSave(normalized)
      setDirty(false)
      addToast('success', '文件已保存')
    } catch (err) {
      addToast('error', `保存失败: ${(err as Error).message}`)
    } finally {
      setSaving(false)
    }
  }, [onSave, addToast])

  const handleClose = useCallback(() => {
    if (dirty && !confirm('文件已修改，确定关闭？未保存的更改将丢失。')) return
    onClose()
  }, [dirty, onClose])

  // Ctrl+S 快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave, handleClose])

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[80vw] h-[80vh] max-w-[1200px] bg-bg-card rounded-xl shadow-2xl border border-border flex flex-col overflow-hidden">
        {/* 标题栏 */}
        <div className="h-[42px] flex items-center justify-between px-4 border-b border-border shrink-0 bg-bg-subtle">
          <div className="flex items-center gap-2 min-w-0">
            <AppIcon icon={icons.fileEdit} size={15} className="text-primary shrink-0" />
            <span className="text-[13px] font-medium text-text-1 truncate" title={filePath}>
              {fileName}
            </span>
            {dirty && <span className="text-[10px] text-status-warning">● 已修改</span>}
            <span className="text-[10px] text-text-3 bg-bg-hover px-1.5 py-0.5 rounded">{langName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              className="flex items-center gap-1 px-3 h-[28px] rounded-md bg-primary text-white text-[12px] hover:bg-primary/90 transition-colors disabled:opacity-50"
              onClick={handleSave}
              disabled={saving || !dirty}
            >
              <AppIcon icon={saving ? icons.loader : icons.save} size={13} />
              保存
            </button>
            <button
              className="p-1.5 rounded-md text-text-2 hover:bg-bg-hover transition-colors"
              onClick={handleClose}
              title="关闭 (Esc)"
            >
              <AppIcon icon={icons.close} size={15} />
            </button>
          </div>
        </div>

        {/* 编辑器区域 */}
        <div ref={editorRef} className="flex-1 overflow-hidden" />

        {/* 底部状态栏 */}
        <div className="h-[24px] flex items-center justify-between px-4 border-t border-border bg-bg-subtle text-[10px] text-text-3 shrink-0">
          <span>{filePath}</span>
          <span>Ctrl+S 保存 · Esc 关闭</span>
        </div>
      </div>
    </div>
  )
}
