const FAVORITES_KEY = 'vortix-theme-favorites'
const RECENTS_KEY = 'vortix-theme-recents'

export const MAX_RECENT_THEMES = 8

export function readFavoriteThemeIds(): string[] {
  return readStoredList(FAVORITES_KEY)
}

export function writeFavoriteThemeIds(values: string[]): void {
  writeStoredList(FAVORITES_KEY, values)
}

export function readRecentThemeIds(): string[] {
  return readStoredList(RECENTS_KEY)
}

export function writeRecentThemeIds(values: string[]): void {
  writeStoredList(RECENTS_KEY, values)
}

function readStoredList(key: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function writeStoredList(key: string, values: string[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(values))
  } catch {
    // ignore storage failures
  }
}
