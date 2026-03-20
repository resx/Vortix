import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { emit, emitTo } from '@tauri-apps/api/event'
import { AppIcon, icons } from '../icons/AppIcon'
import { useSettingsStore, normalizeTerminalHighlightRules } from '../../stores/useSettingsStore'
import type { TerminalHighlightRule } from '../../stores/useSettingsStore'

const PRESET_COLORS = ['#F53F3F', '#E6A23C', '#00B42A', '#4080FF', '#86909C', '#9A7ECC', '#D2B48C', '#00B4D8']

function ColorDot({ color }: { color: string }) {
  return (
    <div
      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
      style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}40` }}
    />
  )
}

function ColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-[28px] h-[28px] rounded-md border border-border cursor-pointer hover:scale-105 transition-transform"
        style={{ backgroundColor: value }}
        title="选择颜色"
      />
      {open && (
        <div className="absolute right-0 bottom-9 mb-1 island-surface rounded-lg p-2 z-10 grid grid-cols-4 gap-1.5 w-[120px]">
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              onClick={() => { onChange(c); setOpen(false) }}
              className="w-5 h-5 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
              style={{ backgroundColor: c }}
            >
              {value === c && <AppIcon icon={icons.check} size={10} className="text-white/80" />}
            </button>
          ))}
          <label className="w-5 h-5 rounded-full overflow-hidden cursor-pointer relative border border-border flex items-center justify-center bg-gradient-to-br from-red-500 via-green-500 to-blue-500 hover:scale-110 transition-transform">
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value.toUpperCase())}
              className="absolute inset-0 opacity-0 w-8 h-8 cursor-pointer"
            />
          </label>
        </div>
      )}
    </div>
  )
}

export default function KeywordHighlightPanel() {
  const rawRules = useSettingsStore((s) => s.termHighlightRules)
  const rules = useMemo(() => normalizeTerminalHighlightRules(rawRules), [rawRules])
  const enabled = useSettingsStore((s) => s.termHighlightEnhance)
  const update = useSettingsStore((s) => s.updateSetting)
  const applySettings = useSettingsStore((s) => s.applySettings)
  const loaded = useSettingsStore((s) => s._loaded)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formPattern, setFormPattern] = useState('')
  const [formColor, setFormColor] = useState('#F53F3F')

  const commitRules = useCallback((next: TerminalHighlightRule[]) => {
    update('termHighlightRules', next)
    if (!loaded) return
    void (async () => {
      await applySettings()
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        const payload = { source: 'highlight-panel', keys: ['termHighlightRules'] as string[] }
        await emit('config-changed', payload)
        await emitTo('settings', 'config-changed', payload)
      }
    })()
  }, [update, applySettings, loaded])

  const handleEdit = (rule: TerminalHighlightRule) => {
    setEditingId(rule.id)
    setFormName(rule.name)
    setFormPattern(rule.pattern)
    setFormColor(rule.color)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setFormName('')
    setFormPattern('')
  }

  const handleSave = () => {
    const name = formName.trim()
    if (!name) return
    const pattern = formPattern.trim() || `\\b${name}\\b`

    if (editingId) {
      commitRules(rules.map(r =>
        r.id === editingId ? { ...r, name, pattern, color: formColor } : r,
      ))
      setEditingId(null)
    } else {
      const newRule: TerminalHighlightRule = {
        id: `custom-${Date.now()}`,
        name,
        pattern,
        flags: 'g',
        color: formColor,
        builtin: false,
      }
      commitRules([...rules, newRule])
    }
    setFormName('')
    setFormPattern('')
  }

  const handleDelete = (id: string) => {
    commitRules(rules.filter(r => r.id !== id))
  }

  const handleClearCustom = () => {
    commitRules(rules.filter(r => r.builtin))
  }

  const hasCustomRules = rules.some(r => !r.builtin)

  return (
    <div className="island-surface rounded-2xl overflow-hidden flex flex-col">
      {/* 头部：标题与总开关 */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/50">
        <div className="text-[11px] font-bold tracking-widest text-text-3 uppercase">
          终端关键词高亮
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-text-3 select-none">启用</span>
          <button
            onClick={() => {
              update('termHighlightEnhance', !enabled)
              if (!loaded) return
              void (async () => {
                await applySettings()
                if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
                  const payload = { source: 'highlight-panel', keys: ['termHighlightEnhance'] as string[] }
                  await emit('config-changed', payload)
                  await emitTo('settings', 'config-changed', payload)
                }
              })()
            }}
            className={`w-9 h-5 rounded-full relative transition-colors duration-300 ${
              enabled ? 'bg-primary' : 'bg-border'
            }`}
          >
            <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-transform duration-300 ${
              enabled ? 'translate-x-[20px]' : 'translate-x-[4px]'
            }`} />
          </button>
        </div>
      </div>

      {/* 规则列表 */}
      <div className={`flex-1 overflow-y-auto max-h-[260px] px-3 py-2 transition-opacity duration-300 custom-scrollbar ${
        !enabled ? 'opacity-40 pointer-events-none' : ''
      }`}>
        {rules.map(rule => (
          <div
            key={rule.id}
            className={`group flex items-center justify-between px-3 py-2 rounded-lg transition-colors border ${
              editingId === rule.id
                ? 'bg-primary/8 border-primary/25'
                : 'hover:bg-bg-hover/60 border-transparent'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <ColorDot color={rule.color} />
              <div className="min-w-0">
                <div className="text-[12px] font-medium truncate" style={{ color: rule.color }}>
                  {rule.name}
                </div>
                <div className="text-[10px] text-text-3 font-mono truncate mt-0.5 max-w-[200px]">
                  {rule.pattern}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              {rule.builtin && (
                <span className="text-[9px] text-text-3 border border-border rounded px-1 py-0.5 mr-1 select-none">预置</span>
              )}
              <button
                onClick={() => handleEdit(rule)}
                className="text-text-3 hover:text-primary p-1 rounded-md hover:bg-bg-hover/70"
                title="编辑"
              >
                <AppIcon icon={icons.edit} size={13} />
              </button>
              {!rule.builtin && (
                <button
                  onClick={() => handleDelete(rule.id)}
                  className="text-text-3 hover:text-status-error p-1 rounded-md hover:bg-bg-hover/70"
                  title="删除"
                >
                  <AppIcon icon={icons.trash} size={13} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {/* 新增/编辑区域 */}
      <div className={`px-5 pt-3 pb-2.5 bg-bg-subtle/60 transition-colors ${!enabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-text-3">
            {editingId ? '编辑规则' : '添加规则'}
          </span>
          {editingId && (
            <button
              onClick={handleCancelEdit}
              className="text-text-3 hover:text-text-1 flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold"
            >
              <AppIcon icon={icons.close} size={11} /> 取消
            </button>
          )}
        </div>
        <div className="flex gap-2 items-stretch">
          <div className="flex-1 flex flex-col gap-1.5">
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="名称 (如 Error)"
              className="w-full island-control px-2.5 py-1.5 text-[12px] placeholder:text-text-disabled"
            />
            <input
              type="text"
              value={formPattern}
              onChange={(e) => setFormPattern(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="正则 (如 \bfailed\b)，留空则精确匹配名称"
              className="w-full island-control px-2.5 py-1.5 text-[12px] font-mono placeholder:text-text-disabled placeholder:font-sans"
            />
          </div>
          <div className="flex flex-col gap-1.5 w-[36px]">
            <ColorPicker value={formColor} onChange={setFormColor} />
            <button
              onClick={handleSave}
              disabled={!formName.trim()}
              className={`w-full h-[28px] flex items-center justify-center rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                editingId
                  ? 'bg-primary/15 text-primary hover:bg-primary hover:text-white'
                  : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'
              }`}
              title={editingId ? '保存' : '添加'}
            >
              <AppIcon icon={editingId ? icons.check : icons.plus} size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 底部 */}
      {hasCustomRules && (
        <div className={`flex items-center justify-end px-5 py-2 border-t border-border/50 bg-bg-subtle/60 ${!enabled ? 'opacity-40 pointer-events-none' : ''}`}>
          <button
            onClick={handleClearCustom}
            className="flex items-center gap-1 text-[11px] text-text-3 hover:text-text-1 transition-colors px-2 py-1 rounded hover:bg-bg-hover/50"
          >
            <AppIcon icon={icons.rotateCw} size={12} />
            清除自定义规则
          </button>
        </div>
      )}
    </div>
  )
}
