import { resolveFontChain } from '../../../lib/fonts'

interface SuggestionVisualOptions {
  cellHeight: number
  fallbackStripeHeight: number
  termFontFamily: string[]
  termFontSize: number
  termStripeEnabled: boolean
  runtimeThemeMode: 'light' | 'dark'
}

export function getSuggestionVisualState({
  cellHeight,
  fallbackStripeHeight,
  termFontFamily,
  termFontSize,
  termStripeEnabled,
  runtimeThemeMode,
}: SuggestionVisualOptions) {
  const stripeHeight = cellHeight > 0 ? cellHeight : fallbackStripeHeight
  const suggestionFontFamily = resolveFontChain(termFontFamily, 'monospace')
  const suggestionFontSize = Math.max(10, termFontSize || 14)
  const stripeBackgroundImage = termStripeEnabled
    ? `repeating-linear-gradient(to bottom,
      transparent 0px, transparent ${stripeHeight}px,
      ${runtimeThemeMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.045)'} ${stripeHeight}px,
      ${runtimeThemeMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.045)'} ${stripeHeight * 2}px)`
    : undefined

  return {
    stripeHeight,
    suggestionFontFamily,
    suggestionFontSize,
    stripeBackgroundImage,
  }
}
