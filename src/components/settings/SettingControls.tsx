import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useSettingsStore, type SettingsState } from '../../stores/useSettingsStore'
import { Switch } from '../ui/switch'
import { SettingsDropdown } from '../ui/select'
import { SettingRow } from './SettingGroup'
import { cn } from '../../lib/utils'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { AppIcon, icons } from '../icons/AppIcon'
import { createPortal } from 'react-dom'
import { Reorder } from 'framer-motion'

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

export function SColumnSelect({ k, label }: { k: keyof SettingsState; label: string }) {
  const storeValue = useSettingsStore((s) => s[k]) as string[]
  const update = useSettingsStore((s) => s.updateSetting)
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [triggerWidth, setTriggerWidth] = useState(200)
  const isSftpColumnDisplay = k === 'sftpRemoteColumns' || k === 'sftpLocalColumns'

  const checked = new Set(storeValue)

  const toggle = (key: string) => {
    const next = new Set(checked)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    update(k, Array.from(next) as never)
  }

  const selectedLabels = FILE_COLUMNS
    .filter((c) => checked.has(c.key))
    .map((c) => c.label)
  const selectedText = selectedLabels.join(',')
  const selectedCount = selectedLabels.length

  const sftpVisibleCount = (() => {
    if (!isSftpColumnDisplay || selectedCount === 0) return 0
    if (triggerWidth >= 156) return Math.min(2, selectedCount)
    if (triggerWidth >= 116) return 1
    return 0
  })()

  const sftpMainText = sftpVisibleCount > 0
    ? selectedLabels.slice(0, sftpVisibleCount).join('、')
    : (selectedCount > 0 ? `${selectedCount} 列` : '未选择')
  const sftpExtraCount = selectedCount - sftpVisibleCount

  const displayText = (() => {
    if (selectedCount === 0) return '未选择'
    if (isSftpColumnDisplay) return sftpMainText
    if (triggerWidth >= 180) return selectedText
    if (triggerWidth >= 120) {
      const head = selectedLabels.slice(0, 2)
      const rest = selectedCount - head.length
      return rest > 0 ? `${head.join(',')} +${rest}` : head.join(',')
    }
    return `已选 ${selectedCount} 列`
  })()

  useEffect(() => {
    const el = triggerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const updateWidth = () => {
      const next = Math.round(el.getBoundingClientRect().width)
      setTriggerWidth((prev) => (prev === next ? prev : next))
    }
    updateWidth()
    const ro = new ResizeObserver(updateWidth)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <SettingRow label={label}>
      <DropdownMenuPrimitive.Root open={open} onOpenChange={setOpen}>
        <DropdownMenuPrimitive.Trigger
          ref={triggerRef}
          title={selectedText || '未选择'}
          className={cn(
            'island-control inline-flex h-[26px] px-2 items-center gap-1 cursor-pointer text-text-2 hover:text-text-1 transition-colors text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:rounded overflow-hidden',
            isSftpColumnDisplay ? 'w-[176px] min-w-[120px] max-w-[176px] ml-auto justify-end' : 'w-[200px] max-w-[36vw] min-w-[96px] justify-between',
          )}
        >
          <span className={cn('truncate min-w-0', isSftpColumnDisplay && 'text-right')}>{displayText}</span>
          {isSftpColumnDisplay && sftpExtraCount > 0 && (
            <span className="shrink-0 rounded-md border border-border/80 bg-bg-base px-1.5 py-[1px] text-[10px] leading-none text-text-3">
              +{sftpExtraCount}
            </span>
          )}
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

interface QueryLocalFontsEntry {
  family: string
}

interface WindowWithLocalFonts extends Window {
  queryLocalFonts?: () => Promise<QueryLocalFontsEntry[]>
}

const PRESET_FONTS: FontItem[] = [
  { value: 'JetBrainsMono', label: '(内置)JetBrains Mono', family: '"JetBrains Mono Variable", "JetBrains Mono", monospace' },
  { value: 'NotoSansSC', label: '(内置)思源黑体', family: '"Noto Sans SC Variable", "Noto Sans SC", "Source Han Sans SC", sans-serif' },
  { value: 'IoskeleyMono', label: '(内置)Ioskeley Mono', family: '"IoskeleyMono", monospace' },
  { value: 'system', label: '(内置)系统字体', family: 'system-ui, -apple-system, sans-serif' },
  { value: 'serif', label: '(内置)Serif', family: 'serif' },
  { value: 'sans-serif', label: '(内置)Sans-serif', family: 'sans-serif' },
  { value: 'monospace', label: '(内置)Monospace', family: 'monospace' },
  { value: 'cursive', label: '(内置)Cursive', family: 'cursive' },
  { value: 'fantasy', label: '(内置)Fantasy', family: 'fantasy', fontWeight: 'bold' },
]

/** 内置字体 value 集合 */
const PRESET_FONT_VALUES = new Set(PRESET_FONTS.map(f => f.value))

/** 获取字体的外部显示名（去掉内置前缀） */
function getFontDisplayName(font: FontItem): string {
  if (PRESET_FONT_VALUES.has(font.value)) {
    return font.label.replace(/^\(内置\)/, '')
  }
  return font.label
}

/* ── 系统字体加载（全局缓存） ── */

let _systemFontsCache: FontItem[] | null = null
let _systemFontsNativeLoaded = false

/** Tauri 环境检测 */
function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window
}

/** 检测字体是否实际可用（通过 document.fonts.check） */
function filterAvailableFonts(fonts: FontItem[]): FontItem[] {
  if (typeof document === 'undefined' || !document.fonts?.check) return fonts
  return fonts.filter(f => {
    try {
      // 仅检测字体名称本身，不含 fallback 族名
      return document.fonts.check(`12px "${f.value}"`)
    } catch {
      return true // 检测失败时保留
    }
  })
}

/** 常用系统字体回退列表（避免 queryLocalFonts 权限弹窗） */
const SYSTEM_FONT_FALLBACK: FontItem[] = [
  // 等宽字体
  { value: 'Cascadia Code', label: 'Cascadia Code', family: '"Cascadia Code", monospace' },
  { value: 'Cascadia Mono', label: 'Cascadia Mono', family: '"Cascadia Mono", monospace' },
  { value: 'Consolas', label: 'Consolas', family: '"Consolas", monospace' },
  { value: 'Courier New', label: 'Courier New', family: '"Courier New", monospace' },
  { value: 'Lucida Console', label: 'Lucida Console', family: '"Lucida Console", monospace' },
  { value: 'Monaco', label: 'Monaco', family: '"Monaco", monospace' },
  { value: 'Menlo', label: 'Menlo', family: '"Menlo", monospace' },
  { value: 'SF Mono', label: 'SF Mono', family: '"SF Mono", monospace' },
  { value: 'DejaVu Sans Mono', label: 'DejaVu Sans Mono', family: '"DejaVu Sans Mono", monospace' },
  { value: 'Liberation Mono', label: 'Liberation Mono', family: '"Liberation Mono", monospace' },
  { value: 'Fira Code', label: 'Fira Code', family: '"Fira Code", monospace' },
  { value: 'Source Code Pro', label: 'Source Code Pro', family: '"Source Code Pro", monospace' },
  // 比例字体
  { value: 'Microsoft YaHei', label: '微软雅黑', family: '"Microsoft YaHei", sans-serif' },
  { value: 'SimHei', label: '黑体', family: '"SimHei", sans-serif' },
  { value: 'SimSun', label: '宋体', family: '"SimSun", serif' },
  { value: 'Segoe UI', label: 'Segoe UI', family: '"Segoe UI", sans-serif' },
  { value: 'Arial', label: 'Arial', family: '"Arial", sans-serif' },
  { value: 'Tahoma', label: 'Tahoma', family: '"Tahoma", sans-serif' },
  { value: 'Verdana', label: 'Verdana', family: '"Verdana", sans-serif' },
]

// Tauri 桌面端：模块加载时先用静态回退列表预填充，后续异步替换为 Rust 原生枚举结果
if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
  _systemFontsCache = filterAvailableFonts(SYSTEM_FONT_FALLBACK)
}

/** 字重/样式后缀，用于合并同族字体变体 */
const WEIGHT_SUFFIXES = /\s+(Thin|ExtraLight|UltraLight|Light|Regular|Medium|SemiBold|DemiBold|Bold|ExtraBold|UltraBold|Black|Heavy|SemiLight|Condensed|Expanded|Narrow|Wide|Italic|Oblique|Variable)$/i

/** 提取字体族根名称（去掉字重/样式后缀） */
function getFontBaseName(family: string): string {
  return family.replace(WEIGHT_SUFFIXES, '').trim()
}

async function getSystemFonts(): Promise<FontItem[]> {
  if (_systemFontsCache && _systemFontsNativeLoaded) return _systemFontsCache

  // Tauri 桌面端：调用 Rust 原生字体枚举（font-kit），获取完整系统字体列表
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const families = await invoke<string[]>('list_system_fonts')
      const presetValues = new Set(PRESET_FONTS.map(f => f.value))
      const baseMap = new Map<string, string>()
      for (const family of families) {
        if (presetValues.has(family)) continue
        const base = getFontBaseName(family)
        if (!baseMap.has(base)) {
          baseMap.set(base, family.length <= base.length ? family : base)
        }
      }
      const result: FontItem[] = []
      for (const [base, representative] of baseMap) {
        result.push({ value: base, label: base, family: `"${representative}"` })
      }
      result.sort((a, b) => a.label.localeCompare(b.label))
      _systemFontsCache = result
      _systemFontsNativeLoaded = true
      return result
    } catch (e) {
      console.warn('[Vortix] Rust 字体枚举失败，回退到静态列表:', e)
      _systemFontsCache = filterAvailableFonts(SYSTEM_FONT_FALLBACK)
      return _systemFontsCache
    }
  }

  try {
    const windowWithLocalFonts = window as WindowWithLocalFonts
    if (typeof windowWithLocalFonts.queryLocalFonts === 'function') {
      const fonts = await windowWithLocalFonts.queryLocalFonts()
      const baseMap = new Map<string, string>() // baseName → 首次出现的原始 family
      const presetValues = new Set(PRESET_FONTS.map(f => f.value))
      for (const f of fonts) {
        if (presetValues.has(f.family)) continue
        const base = getFontBaseName(f.family)
        if (!baseMap.has(base)) {
          // 优先使用不带后缀的原始名称作为代表
          baseMap.set(base, f.family.length <= base.length ? f.family : base)
        }
      }
      const result: FontItem[] = []
      for (const [base, representative] of baseMap) {
        // 使用根名称作为 value/label，确保 CSS 引用最通用的族名
        const displayName = base
        result.push({ value: displayName, label: displayName, family: `"${representative}"` })
      }
      result.sort((a, b) => a.label.localeCompare(b.label))
      _systemFontsCache = result
      return result
    }
  } catch { /* 权限被拒绝或不支持 */ }

  _systemFontsCache = filterAvailableFonts(SYSTEM_FONT_FALLBACK)
  return _systemFontsCache
}

function useSystemFonts(enabled: boolean) {
  const [fonts, setFonts] = useState<FontItem[]>(_systemFontsCache ?? [])
  useEffect(() => {
    if (!enabled) return
    // 已有原生枚举结果，无需再次加载
    if (_systemFontsNativeLoaded && _systemFontsCache) return
    // 非 Tauri 且已有缓存（queryLocalFonts 结果），无需再次加载
    if (!isTauri() && _systemFontsCache) return

    let active = true
    void getSystemFonts().then((nextFonts) => {
      if (active) setFonts(nextFonts)
    })

    return () => {
      active = false
    }
  }, [enabled])

  return fonts
}

/* ── 字体选择器（Portal + 毛玻璃面板 + 有序多选 + 置顶 + 序号） ── */

export function SFontSelect({ k, label, desc, value: externalValue, onChangeFonts }: {
  k?: keyof SettingsState; label: string; desc?: string
  value?: string[]; onChangeFonts?: (fonts: string[]) => void
}) {
  const storeValue = useSettingsStore((s) => k ? s[k] : null) as string[] | null
  const storeUpdate = useSettingsStore((s) => s.updateSetting)
  const selectedFonts = useMemo(
    () => externalValue ?? storeValue ?? [],
    [externalValue, storeValue],
  )
  const updateFonts = useCallback((next: string[]) => {
    if (onChangeFonts) onChangeFonts(next)
    else if (k) storeUpdate(k, next as never)
  }, [onChangeFonts, k, storeUpdate])
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const systemFonts = useSystemFonts(open)

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
    const current = [...selectedFonts]
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
    const current = [...selectedFonts]
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
    if (!open) return
    const frame = window.requestAnimationFrame(() => {
      const p = calcPosition()
      if (p) setPos(p)
      setSearch('')
      inputRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
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

  /* 自动清理：移除 selectedFonts 中不存在于 allFonts 的幽灵值 */
  useEffect(() => {
    if (systemFonts.length === 0) return // 系统字体未加载，不做清理
    const validValues = new Set(allFonts.map(f => f.value))
    const cleaned = selectedFonts.filter(v => validValues.has(v))
    if (cleaned.length < selectedFonts.length && cleaned.length > 0) {
      updateFonts(cleaned)
    }
  }, [allFonts, selectedFonts, systemFonts.length, updateFonts])

  /* 触发按钮展示：最多显示前 2 个字体，超出部分用 +N 省略（外部显示去掉内置前缀） */
  const displayText = (() => {
    const names = selectedFonts.map(v => {
      const font = allFonts.find(f => f.value === v)
      return font ? getFontDisplayName(font) : v
    })
    if (names.length <= 2) return names.join(', ')
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`
  })()

  /* 拖拽排序回调 */
  const isDraggingRef = useRef(false)
  const handleReorder = useCallback((newOrder: string[]) => {
    // newOrder 是已选字体 value 的新顺序，保留未在当前过滤中显示的已选字体
    const visibleSet = new Set(sortedFonts.selected.map(f => f.value))
    const hiddenSelected = selectedFonts.filter(v => !visibleSet.has(v))
    updateFonts([...newOrder, ...hiddenSelected])
  }, [sortedFonts.selected, selectedFonts, updateFonts])

  const selectedValues = useMemo(
    () => sortedFonts.selected.map(f => f.value),
    [sortedFonts.selected],
  )

  const renderSelectedFontItem = (font: FontItem) => {
    return (
      <Reorder.Item
        key={font.value}
        value={font.value}
        className="group flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer transition-colors hover:bg-primary/40"
        onDragStart={() => { isDraggingRef.current = true }}
        onDragEnd={() => { requestAnimationFrame(() => { isDraggingRef.current = false }) }}
        onClick={() => { if (!isDraggingRef.current) handleToggleFont(font.value) }}
        whileDrag={{ scale: 1.02, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 10 }}
      >
        <AppIcon icon={icons.gripVertical} size={12} className="shrink-0 text-text-3 cursor-grab active:cursor-grabbing" />
        <div className={cn(
          'relative flex items-center justify-center w-[15px] h-[15px] rounded-[3px] border-[1.5px] transition-all shrink-0',
          'bg-primary border-primary group-hover:bg-bg-card group-hover:border-bg-card',
        )}>
          <AppIcon icon={icons.check} size={11} className="text-white group-hover:text-primary" />
        </div>
        <span
          className="text-[12px] text-text-1 group-hover:text-white select-none truncate"
          style={{ fontFamily: font.family, fontWeight: font.fontWeight || 'normal' }}
        >
          {font.label}
        </span>
      </Reorder.Item>
    )
  }

  const renderUnselectedFontItem = (font: FontItem) => (
    <div
      key={font.value}
      className="group flex items-center gap-2.5 px-2 py-1 rounded-lg cursor-pointer transition-colors hover:bg-primary/40"
      onClick={() => handleToggleFont(font.value)}
    >
      <div className={cn(
        'relative flex items-center justify-center w-[15px] h-[15px] rounded-[3px] border-[1.5px] transition-all shrink-0',
        'bg-transparent border-primary group-hover:border-bg-card',
      )}>
      </div>
      <span
        className="text-[12px] text-text-1 group-hover:text-white select-none truncate"
        style={{ fontFamily: font.family, fontWeight: font.fontWeight || 'normal' }}
      >
        {font.label}
      </span>
    </div>
  )

  return (
    <SettingRow label={label} desc={desc}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="island-control inline-flex h-[26px] px-2 items-center gap-1 cursor-pointer text-text-2 hover:text-text-1 transition-colors text-[12px] outline-none max-w-[200px] overflow-hidden"
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
                {sortedFonts.selected.length > 0 && (
                  <Reorder.Group axis="y" values={selectedValues} onReorder={handleReorder} className="list-none p-0 m-0">
                    {sortedFonts.selected.map(font => renderSelectedFontItem(font))}
                  </Reorder.Group>
                )}
                {sortedFonts.selected.length > 0 && sortedFonts.unselected.length > 0 && (
                  <div className="mx-2 my-1 border-t border-border-subtle" />
                )}
                {sortedFonts.unselected.map(font => renderUnselectedFontItem(font))}
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
        className={`${width} island-control px-2 text-right text-[12px]`}
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
        className={`${width} island-control px-2 text-center text-[12px] placeholder-text-disabled`}
      />
    </SettingRow>
  )
}
