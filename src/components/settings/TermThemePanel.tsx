import { useState, useRef } from 'react'
import { motion, useDragControls } from 'framer-motion'
import { AppIcon, icons } from '../icons/AppIcon'
import { useTerminalProfileStore } from '../../stores/useTerminalProfileStore'
import { useThemeStore } from '../../stores/useThemeStore'
import { getThemeById, type TermThemePreset } from '../terminal/themes/index'
import { DEFAULT_PROFILE_ID } from '../../types/terminal-profile'
import TermThemePreview from './TermThemePreview'
import TermThemeGrid from './TermThemeGrid'
import KeywordHighlightPanel from './KeywordHighlightPanel'
import * as api from '../../api/client'
import { handleTitleBarMouseDown, handleTitleBarDoubleClick } from '../../lib/window'

interface TermThemePanelProps {
  isOpen: boolean
  onClose: () => void
  windowMode?: boolean
}

/** Light / Dark 切换 Tab */
function ModeTab({
  mode,
  active,
  onClick,
}: {
  mode: 'light' | 'dark'
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors ${
        active
          ? 'bg-primary text-white'
          : 'text-text-2 hover:bg-bg-hover/70'
      }`}
    >
      {mode === 'light' ? '☀ Light' : '● Dark'}
    </button>
  )
}

/** Profile 下拉选择器 */
function ProfileSelector({
  profiles,
  activeId,
  onChange,
}: {
  profiles: { id: string; name: string }[]
  activeId: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const current = profiles.find(p => p.id === activeId)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="island-control inline-flex items-center gap-1.5 h-[28px] px-2.5 text-[12px] text-text-1 transition-colors min-w-[100px]"
      >
        <span className="truncate">{current?.name ?? '默认'}</span>
        <AppIcon icon={icons.chevronDown} size={12} className={`shrink-0 text-text-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[1]" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-[2] min-w-[140px] island-surface rounded-lg py-1">
            {profiles.map(p => (
              <button
                key={p.id}
                onClick={() => { onChange(p.id); setOpen(false) }}
                className={`w-full text-left px-3 py-1.5 text-[12px] transition-colors ${
                  p.id === activeId ? 'text-primary bg-primary/5' : 'text-text-1 hover:bg-bg-base'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function TermThemePanel({ isOpen, onClose, windowMode = false }: TermThemePanelProps) {
  const profileStore = useTerminalProfileStore()
  const themeStore = useThemeStore()
  const allProfiles = profileStore.getAllProfiles()
  const [selectedProfileId, setSelectedProfileId] = useState(profileStore.activeProfileId)
  const [themeBusy, setThemeBusy] = useState(false)

  const profile = profileStore.getProfileById(selectedProfileId) ?? profileStore.getDefaultProfile()

  // 默认 editingMode 跟随当前 UI 模式
  const uiIsDark = document.documentElement.classList.contains('dark')
  const [editingMode, setEditingMode] = useState<'light' | 'dark'>(uiIsDark ? 'dark' : 'light')

  const dragControls = useDragControls()
  const constraintRef = useRef<HTMLDivElement>(null)

  if (!isOpen) return null

  const currentId = editingMode === 'dark' ? profile.colorSchemeDark : profile.colorSchemeLight
  const currentTheme = themeStore.getThemeById(currentId)
  const fallbackPreset = getThemeById(editingMode === 'dark' ? 'default-dark' : 'default-light')!
  const currentPreset: TermThemePreset = currentTheme
    ? { id: currentTheme.id, name: currentTheme.name, mode: currentTheme.mode, theme: currentTheme.terminal }
    : (getThemeById(currentId) ?? fallbackPreset)
  const canManageCurrentTheme = currentTheme?.source === 'custom'

  const handleSelect = (id: string) => {
    const key = editingMode === 'dark' ? 'colorSchemeDark' : 'colorSchemeLight'
    profileStore.updateProfile(selectedProfileId, { [key]: id })
  }

  const handleCreateTheme = async (duplicate = false) => {
    const base = currentTheme ?? themeStore.getThemeById(editingMode === 'dark' ? 'default-dark' : 'default-light')
    if (!base) return
    const defaultName = duplicate ? `${base.name} 副本` : `自定义主题 ${Date.now().toString().slice(-4)}`
    const name = window.prompt('请输入主题名称', defaultName)?.trim()
    if (!name) return
    setThemeBusy(true)
    try {
      const created = await themeStore.createTheme({
        name,
        mode: editingMode,
        terminal: base.terminal,
        highlights: base.highlights,
        ui: base.ui,
        author: base.author,
      })
      handleSelect(created.id)
    } catch (e) {
      window.alert(`创建主题失败：${(e as Error).message}`)
    } finally {
      setThemeBusy(false)
    }
  }

  const handleDeleteTheme = async () => {
    if (!currentTheme || currentTheme.source !== 'custom') return
    const refs = allProfiles.filter((p) => {
      const refId = editingMode === 'dark' ? p.colorSchemeDark : p.colorSchemeLight
      return refId === currentTheme.id
    })
    if (refs.length > 0) {
      window.alert(`该主题仍被 ${refs.length} 个配置引用，请先切换到其他主题后再删除。`)
      return
    }
    if (!window.confirm(`确定删除主题「${currentTheme.name}」吗？`)) return
    setThemeBusy(true)
    try {
      const ok = await themeStore.deleteTheme(currentTheme.id)
      if (!ok) {
        window.alert('删除主题失败')
        return
      }
      handleSelect(editingMode === 'dark' ? 'default-dark' : 'default-light')
    } finally {
      setThemeBusy(false)
    }
  }

  const handleImportTheme = async () => {
    setThemeBusy(true)
    try {
      const picked = await api.pickFile('导入主题文件', 'JSON 文件|*.json|所有文件|*.*')
      if (!picked.content?.trim()) return
      const result = await themeStore.importThemes(picked.content)
      if (result.count > 0) {
        window.alert(`导入成功：${result.count} 个主题`)
      } else {
        window.alert(`导入失败：${result.errors.join('; ') || '未知错误'}`)
      }
    } finally {
      setThemeBusy(false)
    }
  }

  const handleExportTheme = async () => {
    if (!currentTheme || currentTheme.source !== 'custom') return
    setThemeBusy(true)
    try {
      const res = await fetch(api.getThemeExportUrl(currentTheme.id), {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const disposition = res.headers.get('content-disposition') || ''
      const match = /filename="?([^";]+)"?/i.exec(disposition)
      const fileName = match?.[1] || `${currentTheme.name}.vortix-theme.json`
      const saved = await api.saveDownloadToLocal(blob, fileName)
      window.alert(`主题已导出：${saved}`)
    } catch (e) {
      window.alert(`导出主题失败：${(e as Error).message}`)
    } finally {
      setThemeBusy(false)
    }
  }

  const handleCreate = () => {
    const id = profileStore.createProfile({
      ...profile,
      name: `配置 ${allProfiles.length}`,
    })
    setSelectedProfileId(id)
    profileStore.setActiveProfileId(id)
  }

  const handleDuplicate = () => {
    const id = profileStore.duplicateProfile(selectedProfileId, `${profile.name} 副本`)
    if (id) {
      setSelectedProfileId(id)
      profileStore.setActiveProfileId(id)
    }
  }

  const handleDelete = () => {
    if (selectedProfileId === DEFAULT_PROFILE_ID) return
    profileStore.deleteProfile(selectedProfileId)
    setSelectedProfileId(DEFAULT_PROFILE_ID)
    profileStore.setActiveProfileId(DEFAULT_PROFILE_ID)
  }

  const handleProfileChange = (id: string) => {
    setSelectedProfileId(id)
    profileStore.setActiveProfileId(id)
  }

  if (windowMode) {
    return (
      <div className="h-full w-full island-surface rounded-[12px] flex flex-col overflow-hidden">
        <div
          className="h-[46px] flex items-center justify-between px-5 shrink-0 select-none cursor-default border-b border-border/60 bg-bg-card/45"
          onMouseDown={handleTitleBarMouseDown}
          onDoubleClick={handleTitleBarDoubleClick}
        >
          <span className="text-[14px] font-medium text-text-1">终端主题管理器</span>
          <button
            onClick={onClose}
            className="island-btn w-[28px] h-[28px] flex items-center justify-center rounded-md text-text-3 hover:text-text-1 transition-colors"
          >
            <AppIcon icon={icons.close} size={14} />
          </button>
        </div>

        <div className="flex items-center gap-2 px-6 py-3 shrink-0 border-b border-border/50 bg-bg-card/35">
          <span className="text-[12px] text-text-2 shrink-0">配置:</span>
          <ProfileSelector profiles={allProfiles} activeId={selectedProfileId} onChange={handleProfileChange} />
          <button onClick={handleCreate} className="island-btn flex items-center gap-1 h-[28px] px-2 rounded-md text-[11px] text-text-2 transition-colors" title="新建">
            <AppIcon icon={icons.plus} size={13} /> 新建
          </button>
          <button onClick={handleDuplicate} className="island-btn flex items-center gap-1 h-[28px] px-2 rounded-md text-[11px] text-text-2 transition-colors" title="复制">
            <AppIcon icon={icons.copy} size={13} /> 复制
          </button>
          {selectedProfileId !== DEFAULT_PROFILE_ID && (
            <button onClick={handleDelete} className="h-[28px] px-2 rounded-md text-[11px] text-status-error border border-status-error/30 bg-status-error/5 hover:bg-status-error/10 transition-colors inline-flex items-center gap-1" title="删除">
              <AppIcon icon={icons.trash} size={13} /> 删除
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-6">
          <TermThemePreview preset={currentPreset} cursorStyle={profile.cursorStyle} cursorBlink={profile.cursorBlink} />

          <div className="flex items-center justify-between mt-4 mb-3 gap-3">
            <div className="island-surface inline-flex items-center gap-1 rounded-lg p-0.5">
              <ModeTab mode="light" active={editingMode === 'light'} onClick={() => setEditingMode('light')} />
              <ModeTab mode="dark" active={editingMode === 'dark'} onClick={() => setEditingMode('dark')} />
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleCreateTheme(false)}
                disabled={themeBusy}
                className="island-btn h-[28px] px-2.5 rounded-md text-[11px] text-text-2 transition-colors disabled:opacity-50"
              >
                新建主题
              </button>
              <button
                onClick={() => handleCreateTheme(true)}
                disabled={themeBusy}
                className="island-btn h-[28px] px-2.5 rounded-md text-[11px] text-text-2 transition-colors disabled:opacity-50"
              >
                复制主题
              </button>
              <button
                onClick={handleImportTheme}
                disabled={themeBusy}
                className="island-btn h-[28px] px-2.5 rounded-md text-[11px] text-text-2 transition-colors disabled:opacity-50"
              >
                导入
              </button>
              <button
                onClick={handleExportTheme}
                disabled={themeBusy || !canManageCurrentTheme}
                className="island-btn h-[28px] px-2.5 rounded-md text-[11px] text-text-2 transition-colors disabled:opacity-50"
              >
                导出
              </button>
              <button
                onClick={handleDeleteTheme}
                disabled={themeBusy || !canManageCurrentTheme}
                className="h-[28px] px-2.5 rounded-md text-[11px] text-status-error border border-status-error/30 bg-status-error/5 hover:bg-status-error/10 transition-colors disabled:opacity-50"
              >
                删除
              </button>
            </div>
          </div>

          <TermThemeGrid mode={editingMode} selectedId={currentId} onSelect={handleSelect} />

          <div className="mt-5">
            <KeywordHighlightPanel profileId={selectedProfileId} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      ref={constraintRef}
      className="fixed inset-0 z-[310] flex items-center justify-center pointer-events-none p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        drag
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={constraintRef}
        dragMomentum={false}
        dragElastic={0}
        initial={{ scale: 0.96 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.96 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="pointer-events-auto w-[960px] max-w-[95vw] h-[700px] max-h-[95vh] island-surface rounded-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header 拖拽区 */}
        <div
          className="h-[46px] flex items-center justify-between px-5 shrink-0 select-none cursor-default border-b border-border/60 bg-bg-card/45"
          onPointerDown={(e) => {
            if (!(e.target as HTMLElement).closest('button')) dragControls.start(e)
          }}
        >
          <span className="text-[14px] font-medium text-text-1">终端主题配置</span>
          <button
            onClick={onClose}
            className="island-btn w-[28px] h-[28px] flex items-center justify-center rounded-md text-text-3 hover:text-text-1 transition-colors"
          >
            <AppIcon icon={icons.close} size={14} />
          </button>
        </div>

        {/* Profile 工具栏 */}
        <div className="flex items-center gap-2 px-6 py-3 shrink-0 border-b border-border/50 bg-bg-card/35">
          <span className="text-[12px] text-text-2 shrink-0">配置:</span>
          <ProfileSelector profiles={allProfiles} activeId={selectedProfileId} onChange={handleProfileChange} />
          <button onClick={handleCreate} className="island-btn flex items-center gap-1 h-[28px] px-2 rounded-md text-[11px] text-text-2 transition-colors" title="新建">
            <AppIcon icon={icons.plus} size={13} /> 新建
          </button>
          <button onClick={handleDuplicate} className="island-btn flex items-center gap-1 h-[28px] px-2 rounded-md text-[11px] text-text-2 transition-colors" title="复制">
            <AppIcon icon={icons.copy} size={13} /> 复制
          </button>
          {selectedProfileId !== DEFAULT_PROFILE_ID && (
            <button onClick={handleDelete} className="h-[28px] px-2 rounded-md text-[11px] text-status-error border border-status-error/30 bg-status-error/5 hover:bg-status-error/10 transition-colors inline-flex items-center gap-1" title="删除">
              <AppIcon icon={icons.trash} size={13} /> 删除
            </button>
          )}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-6">
          {/* 预览区 */}
          <TermThemePreview preset={currentPreset} cursorStyle={profile.cursorStyle} cursorBlink={profile.cursorBlink} />

          {/* Mode 切换 */}
          <div className="flex items-center justify-between mt-4 mb-3 gap-3">
            <div className="island-surface inline-flex items-center gap-1 rounded-lg p-0.5">
              <ModeTab mode="light" active={editingMode === 'light'} onClick={() => setEditingMode('light')} />
              <ModeTab mode="dark" active={editingMode === 'dark'} onClick={() => setEditingMode('dark')} />
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleCreateTheme(false)}
                disabled={themeBusy}
                className="island-btn h-[28px] px-2.5 rounded-md text-[11px] text-text-2 transition-colors disabled:opacity-50"
              >
                新建主题
              </button>
              <button
                onClick={() => handleCreateTheme(true)}
                disabled={themeBusy}
                className="island-btn h-[28px] px-2.5 rounded-md text-[11px] text-text-2 transition-colors disabled:opacity-50"
              >
                复制主题
              </button>
              <button
                onClick={handleImportTheme}
                disabled={themeBusy}
                className="island-btn h-[28px] px-2.5 rounded-md text-[11px] text-text-2 transition-colors disabled:opacity-50"
              >
                导入
              </button>
              <button
                onClick={handleExportTheme}
                disabled={themeBusy || !canManageCurrentTheme}
                className="island-btn h-[28px] px-2.5 rounded-md text-[11px] text-text-2 transition-colors disabled:opacity-50"
              >
                导出
              </button>
              <button
                onClick={handleDeleteTheme}
                disabled={themeBusy || !canManageCurrentTheme}
                className="h-[28px] px-2.5 rounded-md text-[11px] text-status-error border border-status-error/30 bg-status-error/5 hover:bg-status-error/10 transition-colors disabled:opacity-50"
              >
                删除
              </button>
            </div>
          </div>

          {/* 主题网格 */}
          <TermThemeGrid mode={editingMode} selectedId={currentId} onSelect={handleSelect} />

          {/* 关键词高亮配色 */}
          <div className="mt-5">
            <KeywordHighlightPanel profileId={selectedProfileId} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
