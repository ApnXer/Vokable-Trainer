import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { DE } from './i18n-de'

export type Lang = 'en' | 'de'
export type Theme = 'light' | 'dark' | 'system'
export type CardSize = 'small' | 'medium' | 'large'

export interface Settings {
  lang: Lang
  theme: Theme
  accent: string
  cardSize: CardSize
}

export const DEFAULT_ACCENT = '#3eb489'
export const ACCENTS: { name: string; color: string }[] = [
  { name: 'Mint', color: '#3eb489' },
  { name: 'Ocean', color: '#4255ff' },
  { name: 'Violet', color: '#7c5cff' },
  { name: 'Rose', color: '#e8508e' },
  { name: 'Tangerine', color: '#f28c28' },
  { name: 'Lagoon', color: '#1aa6b7' },
  { name: 'Cherry', color: '#e5484d' },
  { name: 'Graphite', color: '#5b6474' }
]

const DEFAULTS: Settings = { lang: 'en', theme: 'system', accent: DEFAULT_ACCENT, cardSize: 'medium' }
const KEY = 'vt_settings'

export function loadSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Settings>
    return { ...DEFAULTS, ...s, accent: /^#[0-9a-f]{6}$/i.test(s.accent ?? '') ? s.accent! : DEFAULT_ACCENT }
  } catch {
    return { ...DEFAULTS }
  }
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Text auf der Akzentfarbe: Weiß oder ein sehr dunkler Ton, je nachdem, was besser lesbar ist. */
export function onAccent(hex: string): string {
  const l = luminance(hex)
  const dark = '#0b1d17'
  return (1.05) / (l + 0.05) >= (l + 0.05) / (luminance(dark) + 0.05) ? '#ffffff' : dark
}

const CARD_SCALE: Record<CardSize, number> = { small: 0.85, medium: 1, large: 1.2 }

export function applySettings(s: Settings): void {
  const root = document.documentElement
  const dark = s.theme === 'dark' || (s.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  root.dataset.theme = dark ? 'dark' : 'light'
  root.style.setProperty('--accent', s.accent)
  root.style.setProperty('--on-primary', onAccent(s.accent))
  root.style.setProperty('--card-scale', String(CARD_SCALE[s.cardSize]))
  root.lang = s.lang
  document.title = s.lang === 'de' ? 'Vokabeltrainer' : 'Vocab Trainer'
}

/* ---------- Übersetzung ---------- */

export type T = (s: string, params?: Record<string, string | number>) => string

export function translate(lang: Lang, s: string, params?: Record<string, string | number>): string {
  let out = lang === 'de' ? DE[s] ?? s : s
  if (params) for (const [k, v] of Object.entries(params)) out = out.split(`{${k}}`).join(String(v))
  return out
}

interface Ctx {
  settings: Settings
  update(patch: Partial<Settings>): void
  t: T
  /** Einzahl/Mehrzahl: tn(3, '{n} term', '{n} terms') */
  tn(n: number, one: string, many: string, params?: Record<string, string | number>): string
  lang: Lang
}

const SettingsCtx = createContext<Ctx>(null as unknown as Ctx)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  useEffect(() => {
    applySettings(settings)
    try { localStorage.setItem(KEY, JSON.stringify(settings)) } catch { /* Speicher nicht verfügbar */ }
    if (settings.theme !== 'system') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applySettings(settings)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [settings])
  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), [])
  const t: T = useCallback((s, p) => translate(settings.lang, s, p), [settings.lang])
  const tn = useCallback(
    (n: number, one: string, many: string, p?: Record<string, string | number>) => translate(settings.lang, n === 1 ? one : many, { n, ...p }),
    [settings.lang]
  )
  return <SettingsCtx.Provider value={{ settings, update, t, tn, lang: settings.lang }}>{children}</SettingsCtx.Provider>
}

export const useSettings = () => useContext(SettingsCtx)
export const useT = () => {
  const { t, tn, lang } = useContext(SettingsCtx)
  return { t, tn, lang }
}

/** Sprachname in der App-Sprache (z. B. „Französisch“ / „French“) */
export function languageName(code: string, lang: Lang): string {
  try {
    return new Intl.DisplayNames([lang], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}
