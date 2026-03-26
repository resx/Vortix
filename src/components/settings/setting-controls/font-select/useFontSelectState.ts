import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSettingsStore } from '../../../../stores/useSettingsStore'
import { PRESET_FONTS, getFontDisplayName, useSystemFonts } from './font-data'
import { type FontItem, type FontSelectPosition, type SFontSelectProps } from './types'

const FONT_PANEL_WIDTH = 280
const FONT_PANEL_HEIGHT = 370
const FONT_PANEL_MARGIN = 8
const FONT_PANEL_OFFSET = 4

export function useFontSelectState({
  k,
  onChangeFonts,
  value: externalValue,
}: SFontSelectProps) {
  const storeValue = useSettingsStore((state) => (k ? state[k] : null)) as string[] | null
  const storeUpdate = useSettingsStore((state) => state.updateSetting)
  const selectedFonts = useMemo(() => externalValue ?? storeValue ?? [], [externalValue, storeValue])
  const updateFonts = useCallback((next: string[]) => {
    if (onChangeFonts) onChangeFonts(next)
    else if (k) storeUpdate(k, next as never)
  }, [k, onChangeFonts, storeUpdate])

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [pos, setPos] = useState<FontSelectPosition>({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const systemFonts = useSystemFonts(open)

  const allFonts = useMemo(() => [...PRESET_FONTS, ...systemFonts], [systemFonts])
  const filteredFonts = useMemo(() => {
    if (!search.trim()) return allFonts
    const query = search.toLowerCase()
    return allFonts.filter((font) => font.label.toLowerCase().includes(query) || font.family.toLowerCase().includes(query))
  }, [allFonts, search])

  const groups = useMemo(() => {
    const selectedSet = new Set(selectedFonts)
    const source = search.trim() ? filteredFonts : allFonts
    const selected = selectedFonts
      .map((value) => source.find((font) => font.value === value))
      .filter(Boolean) as FontItem[]
    const unselected = filteredFonts.filter((font) => !selectedSet.has(font.value))
    return { selected, unselected }
  }, [allFonts, filteredFonts, search, selectedFonts])

  const isAllSelected = filteredFonts.length > 0 && filteredFonts.every((font) => selectedFonts.includes(font.value))
  const isIndeterminate = filteredFonts.some((font) => selectedFonts.includes(font.value)) && !isAllSelected

  const handleToggleFont = useCallback((fontId: string) => {
    const current = [...selectedFonts]
    const index = current.indexOf(fontId)
    if (index >= 0) current.splice(index, 1)
    else current.push(fontId)
    if (current.length === 0) return
    updateFonts(current)
  }, [selectedFonts, updateFonts])

  const handleToggleAll = useCallback(() => {
    const current = [...selectedFonts]
    if (isAllSelected) {
      const removeSet = new Set(filteredFonts.map((font) => font.value))
      const next = current.filter((value) => !removeSet.has(value))
      if (next.length === 0) return
      updateFonts(next)
      return
    }

    const currentSet = new Set(current)
    for (const font of filteredFonts) {
      if (!currentSet.has(font.value)) current.push(font.value)
    }
    updateFonts(current)
  }, [filteredFonts, isAllSelected, selectedFonts, updateFonts])

  const calcPosition = useCallback((): FontSelectPosition | null => {
    if (!triggerRef.current) return null

    const rect = triggerRef.current.getBoundingClientRect()
    let left = rect.right - FONT_PANEL_WIDTH
    if (left < FONT_PANEL_MARGIN) left = FONT_PANEL_MARGIN
    if (left + FONT_PANEL_WIDTH > window.innerWidth - FONT_PANEL_MARGIN) {
      left = window.innerWidth - FONT_PANEL_WIDTH - FONT_PANEL_MARGIN
    }

    const spaceBelow = window.innerHeight - rect.bottom - FONT_PANEL_MARGIN
    const spaceAbove = rect.top - FONT_PANEL_MARGIN
    let top: number
    if (spaceBelow >= FONT_PANEL_HEIGHT) top = rect.bottom + FONT_PANEL_OFFSET
    else if (spaceAbove >= FONT_PANEL_HEIGHT) top = rect.top - FONT_PANEL_HEIGHT - FONT_PANEL_OFFSET
    else {
      top = spaceBelow >= spaceAbove ? rect.bottom + FONT_PANEL_OFFSET : rect.top - FONT_PANEL_HEIGHT - FONT_PANEL_OFFSET
      top = Math.max(FONT_PANEL_MARGIN, Math.min(top, window.innerHeight - FONT_PANEL_HEIGHT - FONT_PANEL_MARGIN))
    }

    return { top, left }
  }, [])

  const updatePanelPosition = useCallback(() => {
    const next = calcPosition()
    if (next) setPos(next)
  }, [calcPosition])

  useEffect(() => {
    if (!open) return

    const frame = window.requestAnimationFrame(() => {
      updatePanelPosition()
      setSearch('')
      inputRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open, updatePanelPosition])

  useEffect(() => {
    if (!open) return

    const onScroll = () => updatePanelPosition()
    window.addEventListener('scroll', onScroll, true)
    return () => window.removeEventListener('scroll', onScroll, true)
  }, [open, updatePanelPosition])

  useEffect(() => {
    if (!open) return

    const handler = (event: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(event.target as Node)
        && triggerRef.current && !triggerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (systemFonts.length === 0) return

    const validValues = new Set(allFonts.map((font) => font.value))
    const cleaned = selectedFonts.filter((value) => validValues.has(value))
    if (cleaned.length < selectedFonts.length && cleaned.length > 0) {
      updateFonts(cleaned)
    }
  }, [allFonts, selectedFonts, systemFonts.length, updateFonts])

  const displayText = useMemo(() => {
    const names = selectedFonts.map((value) => {
      const font = allFonts.find((item) => item.value === value)
      return font ? getFontDisplayName(font) : value
    })
    if (names.length <= 2) return names.join(', ')
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`
  }, [allFonts, selectedFonts])

  const handleReorder = useCallback((newOrder: string[]) => {
    const visibleSet = new Set(groups.selected.map((font) => font.value))
    const hiddenSelected = selectedFonts.filter((value) => !visibleSet.has(value))
    updateFonts([...newOrder, ...hiddenSelected])
  }, [groups.selected, selectedFonts, updateFonts])

  const selectedValues = useMemo(() => groups.selected.map((font) => font.value), [groups.selected])

  return {
    displayText,
    groups,
    handleReorder,
    handleToggleAll,
    handleToggleFont,
    inputRef,
    isAllSelected,
    isIndeterminate,
    open,
    panelRef,
    pos,
    search,
    selectedValues,
    setSearch,
    toggleOpen: () => setOpen((current) => !current),
    triggerRef,
  }
}
