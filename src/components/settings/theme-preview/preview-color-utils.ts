export function parseHexColor(hex?: string): [number, number, number] | null {
  if (!hex) return null
  const cleaned = hex.trim().replace('#', '')
  const base = cleaned.length >= 6 ? cleaned.slice(0, 6) : ''
  if (!/^[0-9a-fA-F]{6}$/.test(base)) return null
  return [
    Number.parseInt(base.slice(0, 2), 16),
    Number.parseInt(base.slice(2, 4), 16),
    Number.parseInt(base.slice(4, 6), 16),
  ]
}

export function luminance(hex?: string): number | null {
  const rgb = parseHexColor(hex)
  if (!rgb) return null
  const [r, g, b] = rgb.map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(fg?: string, bg?: string): number | null {
  const fgLum = luminance(fg)
  const bgLum = luminance(bg)
  if (fgLum == null || bgLum == null) return null
  const lighter = Math.max(fgLum, bgLum)
  const darker = Math.min(fgLum, bgLum)
  return (lighter + 0.05) / (darker + 0.05)
}

export function fallbackContrastColor(bg: string): string {
  const bgLum = luminance(bg) ?? 0
  return bgLum < 0.5 ? '#F8FAFC' : '#111827'
}

export function ensureContrast(color: string | undefined, bg: string, minRatio = 4.5): string {
  const ratio = contrastRatio(color, bg)
  if (ratio != null && ratio >= minRatio) return color!
  return fallbackContrastColor(bg)
}
