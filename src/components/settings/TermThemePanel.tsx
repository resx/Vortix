import { useState, useRef } from 'react'
import { motion, useDragControls } from 'framer-motion'
import { X, Plus, Copy, Trash2, ChevronDown } from 'lucide-react'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useTerminalProfileStore } from '../../stores/useTerminalProfileStore'
import { getThemeById } from '../terminal/themes/index'
import { DEFAULT_PROFILE_ID } from '../../types/terminal-profile'
import TermThemePreview from './TermThemePreview'
import TermThemeGrid from './TermThemeGrid'
import KeywordHighlightPanel from './KeywordHighlightPanel'
import { SFontSelect } from './SettingControls'

interface TermThemePanelProps {
  isOpen: boolean
  onClose: () => void
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
          : 'text-text-2 hover:bg-border/60'
      }`}
    >
      {mode === 'light' ? '☀ Light' : '● Dark'}
    </button>
  )
}

/** 光标样式选择 */
function CursorStylePicker({
  value,
  onChange,
}: {
  value: 'block' | 'underline' | 'bar'
  onChange: (v: 'block' | 'underline' | 'bar') => void
}) {
  const options: { value: 'block' | 'underline' | 'bar'; label: string }[] = [
    { value: 'block', label: 'Block' },
    { value: 'underline', label: 'Underline' },
    { value: 'bar', label: 'Bar' },
  ]
  return (
    <div className="flex items-center gap-1">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
            value === opt.value
              ? 'bg-primary/10 text-primary'
              : 'text-text-2 hover:bg-border/60'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

/** 数字微调输入 */
function NumberInput({ value, onChange, width = 'w-[60px]' }: {
  value: number; onChange: (v: number) => void; width?: string
}) {
  return (
    <input
      type="text"
      value={String(value)}
      onChange={(e) => {
        const num = parseFloat(e.target.value)
        if (!isNaN(num)) onChange(num)
        else if (e.target.value === '') onChange(0)
      }}
      className={`${width} h-[26px] border border-border bg-bg-card rounded px-2 text-right text-[12px] text-text-1 outline-none`}
    />
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
        className="flex items-center gap-1.5 h-[28px] px-2.5 rounded-md border border-border bg-bg-card text-[12px] text-text-1 hover:border-primary/50 transition-colors min-w-[100px]"
      >
        <span className="truncate">{current?.name ?? '默认'}</span>
        <ChevronDown size={12} className={`shrink-0 text-text-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[1]" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-[2] min-w-[140px] bg-bg-card border border-border rounded-lg shadow-lg py-1">
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

export default function TermThemePanel({ isOpen, onClose }: TermThemePanelProps) {
  const profileStore = useTerminalProfileStore()
  const allProfiles = profileStore.getAllProfiles()
  const [selectedProfileId, setSelectedProfileId] = useState(profileStore.activeProfileId)

  const profile = profileStore.getProfileById(selectedProfileId) ?? profileStore.getDefaultProfile()

  // 默认 editingMode 跟随当前 UI 模式
  const uiIsDark = document.documentElement.classList.contains('dark')
  const [editingMode, setEditingMode] = useState<'light' | 'dark'>(uiIsDark ? 'dark' : 'light')

  const dragControls = useDragControls()
  const constraintRef = useRef<HTMLDivElement>(null)

  if (!isOpen) return null

  const currentId = editingMode === 'dark' ? profile.colorSchemeDark : profile.colorSchemeLight
  const currentPreset = getThemeById(currentId) ?? getThemeById(editingMode === 'dark' ? 'default-dark' : 'default-light')!

  const handleSelect = (id: string) => {
    const key = editingMode === 'dark' ? 'colorSchemeDark' : 'colorSchemeLight'
    profileStore.updateProfile(selectedProfileId, { [key]: id })
  }

  const handleUpdateField = <K extends string>(key: K, value: unknown) => {
    profileStore.updateProfile(selectedProfileId, { [key]: value } as never)
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
        className="pointer-events-auto w-[960px] max-w-[95vw] h-[700px] max-h-[95vh] bg-bg-base rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.16),0_4px_12px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header 拖拽区 */}
        <div
          className="h-[44px] flex items-center justify-between px-5 shrink-0 select-none cursor-default"
          onPointerDown={(e) => {
            if (!(e.target as HTMLElement).closest('button')) dragControls.start(e)
          }}
        >
          <span className="text-[14px] font-medium text-text-1">终端主题配置</span>
          <button
            onClick={onClose}
            className="w-[28px] h-[28px] flex items-center justify-center rounded-md text-text-3 hover:text-text-1 hover:bg-[#FEE2E2] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Profile 工具栏 */}
        <div className="flex items-center gap-2 px-6 pb-3 shrink-0">
          <span className="text-[12px] text-text-2 shrink-0">配置:</span>
          <ProfileSelector profiles={allProfiles} activeId={selectedProfileId} onChange={handleProfileChange} />
          <button onClick={handleCreate} className="flex items-center gap-1 h-[28px] px-2 rounded-md text-[11px] text-text-2 hover:text-primary hover:bg-primary/5 transition-colors" title="新建">
            <Plus size={13} /> 新建
          </button>
          <button onClick={handleDuplicate} className="flex items-center gap-1 h-[28px] px-2 rounded-md text-[11px] text-text-2 hover:text-primary hover:bg-primary/5 transition-colors" title="复制">
            <Copy size={13} /> 复制
          </button>
          {selectedProfileId !== DEFAULT_PROFILE_ID && (
            <button onClick={handleDelete} className="flex items-center gap-1 h-[28px] px-2 rounded-md text-[11px] text-text-2 hover:text-red-500 hover:bg-red-50 transition-colors" title="删除">
              <Trash2 size={13} /> 删除
            </button>
          )}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-6">
          {/* 预览区 */}
          <TermThemePreview preset={currentPreset} cursorStyle={profile.cursorStyle} cursorBlink={profile.cursorBlink} />

          {/* Mode 切换 */}
          <div className="flex items-center justify-between mt-4 mb-3">
            <div className="flex items-center gap-1 bg-bg-base rounded-lg p-0.5 border border-border">
              <ModeTab mode="light" active={editingMode === 'light'} onClick={() => setEditingMode('light')} />
              <ModeTab mode="dark" active={editingMode === 'dark'} onClick={() => setEditingMode('dark')} />
            </div>
          </div>

          {/* 主题网格 */}
          <TermThemeGrid mode={editingMode} selectedId={currentId} onSelect={handleSelect} />

          {/* 关键词高亮配色 */}
          <div className="mt-5">
            <KeywordHighlightPanel profileId={selectedProfileId} />
          </div>

          {/* 终端外观 */}
          <div className="mt-5">
            <div className="text-[13px] font-medium text-text-1 mb-3">终端外观</div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              {/* 左列 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-text-1 font-medium">终端字体</span>
                  <SFontSelect k="termFontFamily" label="" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-text-1 font-medium">终端字号</span>
                  <NumberInput value={profile.fontSize} onChange={(v) => handleUpdateField('fontSize', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-text-1 font-medium">终端行高</span>
                  <NumberInput value={profile.lineHeight} onChange={(v) => handleUpdateField('lineHeight', v)} />
                </div>
              </div>
              {/* 右列 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-text-1 font-medium">终端间距</span>
                  <NumberInput value={profile.letterSpacing} onChange={(v) => handleUpdateField('letterSpacing', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-text-1 font-medium">缓存行数</span>
                  <NumberInput value={profile.scrollback} onChange={(v) => handleUpdateField('scrollback', v)} />
                </div>
              </div>
            </div>

            {/* 光标设置 */}
            <div className="flex items-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-text-2">光标样式</span>
                <CursorStylePicker value={profile.cursorStyle} onChange={(v) => handleUpdateField('cursorStyle', v)} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-text-2">光标闪烁</span>
                <button
                  onClick={() => handleUpdateField('cursorBlink', !profile.cursorBlink)}
                  className={`w-[36px] h-[20px] rounded-full transition-colors relative ${profile.cursorBlink ? 'bg-primary' : 'bg-border'}`}
                >
                  <div className={`absolute top-[2px] w-[16px] h-[16px] rounded-full bg-white shadow-sm transition-transform ${profile.cursorBlink ? 'left-[18px]' : 'left-[2px]'}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
