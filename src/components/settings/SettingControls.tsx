import { useState, useRef, useEffect, useMemo } from 'react'
import { useSettingsStore, type SettingsState } from '../../stores/useSettingsStore'
import { Switch } from '../ui/switch'
import { SettingsDropdown } from '../ui/select'
import { SettingRow } from './SettingGroup'
import { cn } from '../../lib/utils'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { AppIcon, icons } from '../icons/AppIcon'
import { createPortal } from 'react-dom'

/* ── 公共便捷封装 ── */

export function SToggle({ k, label, desc }: { k: keyof SettingsState; label: string; desc?: string }) {
  const value = useSettingsStore((s) => s[k]) as boolean
  const update = useSettingsStore((s) => s.updateSetting)
  return (
    <SettingRow label={label} desc={desc}>
      <Switch checked={value} onCheckedChange={() => update(k, !value as never)} />
    </SettingRow>
  )
}

export function SDropdown({ k, label, desc, options, width = 'w-[120px]' }: {
  k: keyof SettingsState; label: string; desc?: string
  options: { value: string; label: string }[]; width?: string
}) {
  const value = useSettingsStore((s) => s[k]) as string
  const update = useSettingsStore((s) => s.updateSetting)
  return (
    <SettingRow label={label} desc={desc}>
      <SettingsDropdown value={value} options={options} onChange={(v) => update(k, v as never)} width={width} />
    </SettingRow>
  )
}

export function SNumberDropdown({ k, label, desc, options, width = 'w-[100px]' }: {
  k: keyof SettingsState; label: string; desc?: string
  options: { value: number; label: string }[]; width?: string
}) {
  const value = useSettingsStore((s) => s[k]) as number
  const update = useSettingsStore((s) => s.updateSetting)
  return (
    <SettingRow label={label} desc={desc}>
      <SettingsDropdown
        value={String(value)}
        options={options.map((o) => ({ value: String(o.value), label: o.label }))}
        onChange={(v) => update(k, Number(v) as never)}
        width={width}
      />
    </SettingRow>
  )
}

/* ── 多选列复选框下拉 ── */

const FILE_COLUMNS = [
  { key: 'name', label: '名称' },
  { key: 'mtime', label: '修改时间' },
  { key: 'type', label: '类型' },
  { key: 'size', label: '大小' },
  { key: 'perm', label: '权限' },
  { key: 'owner', label: '用户/组' },
]

const DEFAULT_CHECKED = new Set(['name', 'mtime', 'type', 'size'])

export function SColumnSelect({ k, label }: { k: keyof SettingsState; label: string }) {
  const storeValue = useSettingsStore((s) => s[k]) as string[]
  const update = useSettingsStore((s) => s.updateSetting)
  const [open, setOpen] = useState(false)

  const checked = new Set(storeValue)

  const toggle = (key: string) => {
    const next = new Set(checked)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    update(k, Array.from(next) as never)
  }

  const selectedText = FILE_COLUMNS
    .filter((c) => checked.has(c.key))
    .map((c) => c.label)
    .join(',')

  return (
    <SettingRow label={label}>
      <DropdownMenuPrimitive.Root open={open} onOpenChange={setOpen}>
        <DropdownMenuPrimitive.Trigger className="flex items-center gap-1 cursor-pointer text-text-2 hover:text-text-1 transition-colors text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:rounded">
          <span className="max-w-[200px] truncate">{selectedText || '未选择'}</span>
          {open ? <AppIcon icon={icons.chevronUp} size={14} className="shrink-0" /> : <AppIcon icon={icons.chevronDown} size={14} className="shrink-0" />}
        </DropdownMenuPrimitive.Trigger>
        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            side="bottom"
            align="end"
            sideOffset={4}
            className="z-[1050] glass-context rounded-lg py-1 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          >
            {FILE_COLUMNS.map((col) => (
              <DropdownMenuPrimitive.CheckboxItem
                key={col.key}
                checked={checked.has(col.key)}
                onCheckedChange={() => toggle(col.key)}
                onSelect={(e) => e.preventDefault()}
                className="flex items-center gap-2.5 px-3 py-1.5 text-[13px] cursor-pointer select-none outline-none data-[highlighted]:bg-bg-active text-text-1"
              >
                <div
                  className={cn(
                    'w-[16px] h-[16px] rounded-[4px] flex items-center justify-center border transition-colors shrink-0',
                    checked.has(col.key)
                      ? 'bg-primary border-primary'
                      : 'bg-bg-card border-text-disabled',
                  )}
                >
                  {checked.has(col.key) && <AppIcon icon={icons.check} size={11} className="text-white" />}
                </div>
                {col.label}
              </DropdownMenuPrimitive.CheckboxItem>
            ))}
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>
    </SettingRow>
  )
}

/* ── 预置字体列表 ── */

interface FontItem {
  value: string
  label: string
  family: string
  fontWeight?: string
}

const PRESET_FONTS: FontItem[] = [
  { value: 'system', label: '(内置)系统字体', family: 'system-ui, -apple-system, sans-serif' },
  { value: 'JetBrainsMono', label: '(内置)JetBrainsMono', family: '"JetBrains Mono Variable", "JetBrains Mono", monospace' },
  { value: 'NotoSansSC', label: '(内置)思源黑体', family: '"Noto Sans SC Variable", "Noto Sans SC", "Source Han Sans SC", sans-serif' },
  { value: 'serif', label: '(内置)Serif', family: 'serif' },
  { value: 'sans-serif', label: '(内置)Sans-serif', family: 'sans-serif' },
  { value: 'monospace', label: '(内置)Monospace', family: 'monospace' },
  { value: 'cursive', label: '(内置)Cursive', family: 'cursive' },
  { value: 'fantasy', label: '【内置】Fantasy', family: 'fantasy', fontWeight: 'bold' },
  { value: 'FiraCode', label: 'Fira Code', family: '"Fira Code", monospace' },
  { value: 'SourceCodePro', label: 'Source Code Pro', family: '"Source Code Pro", monospace' },
  { value: 'CascadiaCode', label: 'Cascadia Code', family: '"Cascadia Code", monospace' },
  { value: 'CascadiaMono', label: 'Cascadia Mono', family: '"Cascadia Mono", monospace' },
  { value: 'Inconsolata', label: 'Inconsolata', family: '"Inconsolata", monospace' },
  { value: 'RobotoMono', label: 'Roboto Mono', family: '"Roboto Mono", monospace' },
  { value: 'UbuntuMono', label: 'Ubuntu Mono', family: '"Ubuntu Mono", monospace' },
  { value: 'IBMPlexMono', label: 'IBM Plex Mono', family: '"IBM Plex Mono", monospace' },
  { value: 'Hack', label: 'Hack', family: '"Hack", monospace' },
  { value: 'VictorMono', label: 'Victor Mono', family: '"Victor Mono", monospace' },
  { value: 'NotoSansMono', label: 'Noto Sans Mono', family: '"Noto Sans Mono", monospace' },
  { value: 'SpaceMono', label: 'Space Mono', family: '"Space Mono", monospace' },
  { value: 'AnonymousPro', label: 'Anonymous Pro', family: '"Anonymous Pro", monospace' },
  { value: 'Cousine', label: 'Cousine', family: '"Cousine", monospace' },
]

/* ── 系统字体加载（全局缓存） ── */

let _systemFontsCache: FontItem[] | null = null

async function getSystemFonts(): Promise<FontItem[]> {
  if (_systemFontsCache) return _systemFontsCache
  try {
    if ('queryLocalFonts' in window) {
      const fonts: Array<{ family: string }> = await (window as any).queryLocalFonts()
      const seen = new Set<string>()
      const presetValues = new Set(PRESET_FONTS.map(f => f.value))
      const result: FontItem[] = []
      for (const f of fonts) {
        if (!seen.has(f.family) && !presetValues.has(f.family)) {
          seen.add(f.family)
          result.push({ value: f.family, label: f.family, family: `"${f.family}"` })
        }
      }
      result.sort((a, b) => a.label.localeCompare(b.label))
      _systemFontsCache = result
      return result
    }
  } catch { /* 权限被拒绝或不支持 */ }
  _systemFontsCache = [
    { value: 'Consolas', label: 'Consolas', family: '"Consolas", monospace' },
    { value: 'Courier New', label: 'Courier New', family: '"Courier New", monospace' },
    { value: 'Lucida Console', label: 'Lucida Console', family: '"Lucida Console", monospace' },
    { value: 'Monaco', label: 'Monaco', family: '"Monaco", monospace' },
    { value: 'Menlo', label: 'Menlo', family: '"Menlo", monospace' },
    { value: 'SF Mono', label: 'SF Mono', family: '"SF Mono", monospace' },
    { value: 'DejaVu Sans Mono', label: 'DejaVu Sans Mono', family: '"DejaVu Sans Mono", monospace' },
    { value: 'Liberation Mono', label: 'Liberation Mono', family: '"Liberation Mono", monospace' },
  ]
  return _systemFontsCache
}

function useSystemFonts() {
  const [fonts, setFonts] = useState<FontItem[]>(_systemFontsCache ?? [])
  useEffect(() => { getSystemFonts().then(setFonts) }, [])
  return fonts
}

/* ── 字体选择器（Portal + 毛玻璃面板 + 有序多选 + 置顶 + 序号） ── */

export function SFontSelect({ k, label, desc, value: externalValue, onChangeFonts }: {
  k?: keyof SettingsState; label: string; desc?: string
  value?: string[]; onChangeFonts?: (fonts: string[]) => void
}) {
  const storeValue = useSettingsStore((s) => k ? s[k] : null) as string[] | null
  const storeUpdate = useSettingsStore((s) => s.updateSetting)
  const selectedFonts = externalValue ?? storeValue ?? []
  const selectedFontsRef = useRef(selectedFonts)
  selectedFontsRef.current = selectedFonts
  const updateFonts = (next: string[]) => {
    selectedFontsRef.current = next
    if (onChangeFonts) onChangeFonts(next)
    else if (k) storeUpdate(k, next as never)
  }
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const systemFonts = useSystemFonts()

  /* 合并预置 + 系统字体 */
  const allFonts = useMemo(() => [...PRESET_FONTS, ...systemFonts], [systemFonts])

  /* 搜索过滤 */
  const filteredFonts = useMemo(() => {
    if (!search.trim()) return allFonts
    const q = search.toLowerCase()
    return allFonts.filter(f => f.label.toLowerCase().includes(q) || f.family.toLowerCase().includes(q))
  }, [allFonts, search])

  /* 排序：已选置顶（按选择顺序），未选在下方 */
  const sortedFonts = useMemo(() => {
    const selectedSet = new Set(selectedFonts)
    const selected = selectedFonts
      .map(v => (search.trim() ? filteredFonts : allFonts).find(f => f.value === v))
      .filter(Boolean) as FontItem[]
    const unselected = filteredFonts.filter(f => !selectedSet.has(f.value))
    return { selected, unselected }
  }, [selectedFonts, filteredFonts, allFonts, search])

  /* 全选逻辑 */
  const isAllSelected = filteredFonts.length > 0 && filteredFonts.every(f => selectedFonts.includes(f.value))
  const isIndeterminate = filteredFonts.some(f => selectedFonts.includes(f.value)) && !isAllSelected

  const handleToggleFont = (fontId: string) => {
    const current = [...selectedFontsRef.current]
    const idx = current.indexOf(fontId)
    if (idx >= 0) {
      current.splice(idx, 1)
    } else {
      current.push(fontId)
    }
    // 至少保留一个字体
    if (current.length === 0) return
    updateFonts(current)
  }

  const handleToggleAll = () => {
    const current = [...selectedFontsRef.current]
    if (isAllSelected) {
      // 取消：移除过滤列表中的字体，但保留不在过滤结果中的已选字体
      const removeSet = new Set(filteredFonts.map(f => f.value))
      const next = current.filter(v => !removeSet.has(v))
      // 至少保留一个
      if (next.length === 0) return
      updateFonts(next)
    } else {
      // 全选：将过滤列表中未选的追加到末尾
      const currentSet = new Set(current)
      for (const f of filteredFonts) {
        if (!currentSet.has(f.value)) {
          current.push(f.value)
        }
      }
      updateFonts(current)
    }
  }

  /* Portal 定位：基于 trigger 按钮的 viewport 坐标，支持滚动跟踪 */
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const calcPosition = () => {
    if (!triggerRef.current) return null
    const rect = triggerRef.current.getBoundingClientRect()
    const panelW = 280, panelH = 370
    let left = rect.right - panelW
    if (left < 8) left = 8
    if (left + panelW > window.innerWidth - 8) left = window.innerWidth - panelW - 8

    const spaceBelow = window.innerHeight - rect.bottom - 8
    const spaceAbove = rect.top - 8
    let top: number
    if (spaceBelow >= panelH) {
      top = rect.bottom + 4
    } else if (spaceAbove >= panelH) {
      top = rect.top - panelH - 4
    } else {
      // 上下都不够，选空间大的一侧并钳位到视口内
      top = spaceBelow >= spaceAbove ? rect.bottom + 4 : rect.top - panelH - 4
      top = Math.max(8, Math.min(top, window.innerHeight - panelH - 8))
    }
    return { top, left }
  }

  useEffect(() => {
    if (open) {
      const p = calcPosition()
      if (p) setPos(p)
      setSearch('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  /* 滚动跟踪：设置面板内容区滚动时重新定位 */
  useEffect(() => {
    if (!open) return
    const onScroll = () => {
      const p = calcPosition()
      if (p) setPos(p)
    }
    window.addEventListener('scroll', onScroll, true)
    return () => window.removeEventListener('scroll', onScroll, true)
  }, [open])

  /* 点击外部关闭 */
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  /* 触发按钮展示：逗号分隔 */
  const displayText = selectedFonts
    .map(v => allFonts.find(f => f.value === v)?.label ?? v)
    .join(', ')

  /* 序号圆标 */
  const NUM_BADGES = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩']

  const renderFontItem = (font: FontItem, isSelected: boolean) => {
    const orderIdx = selectedFonts.indexOf(font.value)
    return (
      <div
        key={font.value}
        className="group flex items-center gap-2.5 px-2 py-1 rounded-lg cursor-pointer transition-colors hover:bg-primary/40"
        onClick={() => handleToggleFont(font.value)}
      >
        <div className={cn(
          'relative flex items-center justify-center w-[15px] h-[15px] rounded-[3px] border-[1.5px] transition-all shrink-0',
          isSelected
            ? 'bg-primary border-primary group-hover:bg-bg-card group-hover:border-bg-card'
            : 'bg-transparent border-primary group-hover:border-bg-card',
        )}>
          {isSelected && (
            <AppIcon icon={icons.check} size={11} className="text-white group-hover:text-primary" />
          )}
        </div>
        {isSelected && orderIdx >= 0 && (
          <span className="text-[10px] text-primary font-medium shrink-0 group-hover:text-white">
            {NUM_BADGES[orderIdx] ?? `${orderIdx + 1}`}
          </span>
        )}
        <span
          className="text-[12px] text-text-1 group-hover:text-white select-none truncate"
          style={{ fontFamily: font.family, fontWeight: font.fontWeight || 'normal' }}
        >
          {font.label}
        </span>
      </div>
    )
  }

  return (
    <SettingRow label={label} desc={desc}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 cursor-pointer text-text-2 hover:text-text-1 transition-colors text-[13px] outline-none max-w-[280px]"
        title={displayText}
      >
        <span className="truncate">{displayText}</span>
        <AppIcon icon={icons.chevronDown} size={14} className={cn('shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          className="fixed z-[1100] w-[280px] flex flex-col rounded-xl overflow-hidden glass-context"
          style={{
            top: pos.top,
            left: pos.left,
          }}
        >
          {/* 头部：搜索 + 全选 */}
          <div className="flex items-center gap-2 px-2.5 pt-2 pb-1.5">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
                <AppIcon icon={icons.search} size={12} className="text-text-3" />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索..."
                className="w-full h-7 pl-7 pr-2 text-[11px] bg-bg-subtle/60 border border-border-subtle rounded-md outline-none focus:bg-bg-card/80 focus:border-primary focus:ring-1 focus:ring-primary/40 transition-all placeholder-text-3 text-text-1"
              />
            </div>
            <label className="flex items-center gap-1 cursor-pointer text-[11px] text-text-2 hover:text-text-1 shrink-0 pr-0.5 select-none">
              <div className="relative flex items-center justify-center w-3.5 h-3.5 rounded-sm border border-text-3 dark:border-text-2 bg-transparent transition-colors">
                {isIndeterminate && !isAllSelected && (
                  <div className="w-2 h-0.5 bg-primary rounded-sm" />
                )}
                {isAllSelected && (
                  <AppIcon icon={icons.check} size={10} className="text-primary" />
                )}
                <input
                  type="checkbox"
                  className="absolute opacity-0 cursor-pointer w-full h-full"
                  checked={isAllSelected}
                  onChange={handleToggleAll}
                />
              </div>
              全选
            </label>
          </div>

          {/* 字体列表 */}
          <div className="h-[320px] overflow-y-auto font-list-scrollbar p-1.5 pt-0">
            {sortedFonts.selected.length === 0 && sortedFonts.unselected.length === 0 ? (
              <div className="text-center text-text-3 py-8 text-[12px]">无匹配字体</div>
            ) : (
              <>
                {sortedFonts.selected.map(font => renderFontItem(font, true))}
                {sortedFonts.selected.length > 0 && sortedFonts.unselected.length > 0 && (
                  <div className="mx-2 my-1 border-t border-border-subtle" />
                )}
                {sortedFonts.unselected.map(font => renderFontItem(font, false))}
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </SettingRow>
  )
}

/* ── 数字输入框 ── */

export function SNumberInput({ k, label, desc, width = 'w-[60px]' }: {
  k: keyof SettingsState; label: string; desc?: string; width?: string
}) {
  const value = useSettingsStore((s) => s[k]) as number
  const update = useSettingsStore((s) => s.updateSetting)
  return (
    <SettingRow label={label} desc={desc}>
      <input
        type="text"
        value={String(value)}
        onChange={(e) => {
          const num = parseInt(e.target.value, 10)
          if (!isNaN(num)) update(k, num as never)
          else if (e.target.value === '') update(k, 0 as never)
        }}
        className={`${width} h-[26px] border border-border bg-bg-card rounded px-2 text-right text-[12px] text-text-1 outline-none`}
      />
    </SettingRow>
  )
}

/* ── 文本输入框 ── */

export function STextInput({ k, label, desc, width = 'w-[60px]', placeholder }: {
  k: keyof SettingsState; label: string; desc?: string; width?: string; placeholder?: string
}) {
  const value = useSettingsStore((s) => s[k]) as string
  const update = useSettingsStore((s) => s.updateSetting)
  return (
    <SettingRow label={label} desc={desc}>
      <input
        type="text"
        value={value}
        onChange={(e) => update(k, e.target.value as never)}
        placeholder={placeholder}
        className={`${width} h-[26px] border border-border bg-bg-card rounded px-2 text-center text-[12px] text-text-1 outline-none placeholder-text-disabled`}
      />
    </SettingRow>
  )
}
