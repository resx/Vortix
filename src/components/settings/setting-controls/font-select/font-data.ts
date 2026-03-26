import { useEffect, useState } from 'react'
import { type FontItem, type WindowWithLocalFonts } from './types'

export const PRESET_FONTS: FontItem[] = [
  { value: 'JetBrainsMono', label: '(??)JetBrains Mono', family: '"JetBrains Mono Variable", "JetBrains Mono", monospace' },
  { value: 'NotoSansSC', label: '(??)????', family: '"Noto Sans SC Variable", "Noto Sans SC", "Source Han Sans SC", sans-serif' },
  { value: 'IoskeleyMono', label: '(??)Ioskeley Mono', family: '"IoskeleyMono", monospace' },
  { value: 'system', label: '(??)????', family: 'system-ui, -apple-system, sans-serif' },
  { value: 'serif', label: '(??)Serif', family: 'serif' },
  { value: 'sans-serif', label: '(??)Sans-serif', family: 'sans-serif' },
  { value: 'monospace', label: '(??)Monospace', family: 'monospace' },
  { value: 'cursive', label: '(??)Cursive', family: 'cursive' },
  { value: 'fantasy', label: '(??)Fantasy', family: 'fantasy', fontWeight: 'bold' },
]

const PRESET_FONT_VALUES = new Set(PRESET_FONTS.map((font) => font.value))

const SYSTEM_FONT_FALLBACK: FontItem[] = [
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
  { value: 'Microsoft YaHei', label: '????', family: '"Microsoft YaHei", sans-serif' },
  { value: 'SimHei', label: '??', family: '"SimHei", sans-serif' },
  { value: 'SimSun', label: '??', family: '"SimSun", serif' },
  { value: 'Segoe UI', label: 'Segoe UI', family: '"Segoe UI", sans-serif' },
  { value: 'Arial', label: 'Arial', family: '"Arial", sans-serif' },
  { value: 'Tahoma', label: 'Tahoma', family: '"Tahoma", sans-serif' },
  { value: 'Verdana', label: 'Verdana', family: '"Verdana", sans-serif' },
]

let systemFontsCache: FontItem[] | null = null
let systemFontsNativeLoaded = false

if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
  systemFontsCache = filterAvailableFonts(SYSTEM_FONT_FALLBACK)
}

const WEIGHT_SUFFIXES = /\s+(Thin|ExtraLight|UltraLight|Light|Regular|Medium|SemiBold|DemiBold|Bold|ExtraBold|UltraBold|Black|Heavy|SemiLight|Condensed|Expanded|Narrow|Wide|Italic|Oblique|Variable)$/i

export function getFontDisplayName(font: FontItem): string {
  if (PRESET_FONT_VALUES.has(font.value)) {
    return font.label.replace(/^\(.*?\)/, '')
  }
  return font.label
}

function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window
}

function filterAvailableFonts(fonts: FontItem[]): FontItem[] {
  if (typeof document === 'undefined' || !document.fonts?.check) return fonts
  return fonts.filter((font) => {
    try {
      return document.fonts.check(`12px "${font.value}"`)
    } catch {
      return true
    }
  })
}

function getFontBaseName(family: string): string {
  return family.replace(WEIGHT_SUFFIXES, '').trim()
}

async function getSystemFonts(): Promise<FontItem[]> {
  if (systemFontsCache && systemFontsNativeLoaded) return systemFontsCache

  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const families = await invoke<string[]>('list_system_fonts')
      const presetValues = new Set(PRESET_FONTS.map((font) => font.value))
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
      systemFontsCache = result
      systemFontsNativeLoaded = true
      return result
    } catch (error) {
      console.warn('[Vortix] Rust ??????,???????:', error)
      systemFontsCache = filterAvailableFonts(SYSTEM_FONT_FALLBACK)
      return systemFontsCache
    }
  }

  try {
    const windowWithLocalFonts = window as WindowWithLocalFonts
    if (typeof windowWithLocalFonts.queryLocalFonts === 'function') {
      const fonts = await windowWithLocalFonts.queryLocalFonts()
      const baseMap = new Map<string, string>()
      const presetValues = new Set(PRESET_FONTS.map((font) => font.value))
      for (const font of fonts) {
        if (presetValues.has(font.family)) continue
        const base = getFontBaseName(font.family)
        if (!baseMap.has(base)) {
          baseMap.set(base, font.family.length <= base.length ? font.family : base)
        }
      }
      const result: FontItem[] = []
      for (const [base, representative] of baseMap) {
        result.push({ value: base, label: base, family: `"${representative}"` })
      }
      result.sort((a, b) => a.label.localeCompare(b.label))
      systemFontsCache = result
      return result
    }
  } catch {
    // ignore
  }

  systemFontsCache = filterAvailableFonts(SYSTEM_FONT_FALLBACK)
  return systemFontsCache
}

export function useSystemFonts(enabled: boolean) {
  const [fonts, setFonts] = useState<FontItem[]>(systemFontsCache ?? [])

  useEffect(() => {
    if (!enabled) return
    if (systemFontsNativeLoaded && systemFontsCache) return
    if (!isTauri() && systemFontsCache) return

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
