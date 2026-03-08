/* ── 轻量 i18n 框架（基于 Zustand 响应式） ── */

import { create } from 'zustand'

type Translations = Record<string, string>

interface I18nState {
  locale: string
  translations: Translations
  _setLocale: (locale: string, translations: Translations) => void
}

const useI18nStore = create<I18nState>((set) => ({
  locale: 'zh-CN',
  translations: {},
  _setLocale: (locale, translations) => set({ locale, translations }),
}))

/** 异步加载语言包 */
export async function loadLocale(locale: string): Promise<void> {
  try {
    const mod = await import(`./locales/${locale}.json`)
    useI18nStore.getState()._setLocale(locale, mod.default)
  } catch {
    console.warn(`[i18n] 语言包 ${locale} 加载失败，回退到 zh-CN`)
    if (locale !== 'zh-CN') {
      await loadLocale('zh-CN')
    }
  }
}

/** 翻译函数：支持 {key} 插值 */
export function t(key: string, params?: Record<string, string | number>): string {
  const { translations } = useI18nStore.getState()
  let text = translations[key] || key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    }
  }
  return text
}

/** React hook：订阅语言变化，自动重渲染 */
export function useT() {
  const translations = useI18nStore((s) => s.translations)
  return (key: string, params?: Record<string, string | number>): string => {
    let text = translations[key] || key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      }
    }
    return text
  }
}

/** 获取当前语言 */
export function useLocale(): string {
  return useI18nStore((s) => s.locale)
}
