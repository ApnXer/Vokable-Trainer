import type { Card, StudySet } from '@shared/types'
import { normalize } from '@shared/text'

export type Dir = 'td' | 'dt' | 'mix'

export interface StudyOpts {
  dir: Dir
  starred: boolean
  shuffle: boolean
  track: boolean
  learn: { mc: boolean; tf: boolean; write: boolean }
  test: { count: number; mc: boolean; tf: boolean; write: boolean; match: boolean }
}

const DEFAULTS: StudyOpts = {
  dir: 'td',
  starred: false,
  shuffle: false,
  track: true,
  learn: { mc: true, tf: false, write: true },
  test: { count: 20, mc: true, tf: true, write: true, match: true }
}

export function loadOpts(): StudyOpts {
  try {
    const s = JSON.parse(localStorage.getItem('vt_opts') || '{}') as Partial<StudyOpts>
    return { ...DEFAULTS, ...s, learn: { ...DEFAULTS.learn, ...s.learn }, test: { ...DEFAULTS.test, ...s.test } }
  } catch {
    return structuredClone(DEFAULTS)
  }
}

export function saveOpts(o: StudyOpts): void {
  try { localStorage.setItem('vt_opts', JSON.stringify(o)) } catch { /* Speicher nicht verfügbar */ }
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const usable = (s: StudySet) => s.cards.filter((c) => c.term && c.definition)

/** Karten für eine Lerneinheit: feste IDs (z. B. „falsche Karten“) oder Filter aus den Optionen. */
export function buildDeck(s: StudySet, o: StudyOpts, ids?: string[] | null): Card[] {
  let cards = usable(s)
  if (ids?.length) cards = cards.filter((c) => ids.includes(c.id))
  else if (o.starred && cards.some((c) => c.starred)) cards = cards.filter((c) => c.starred)
  return o.shuffle ? shuffle(cards) : cards
}

export interface QA {
  q: string
  a: string
  qLang: string
  aLang: string
  dir: 'td' | 'dt'
}

export function qa(card: Card, s: StudySet, dir: Dir): QA {
  const d = dir === 'mix' ? (Math.random() < 0.5 ? 'td' : 'dt') : dir
  return d === 'td'
    ? { q: card.term, a: card.definition, qLang: s.termLang, aLang: s.defLang, dir: d }
    : { q: card.definition, a: card.term, qLang: s.defLang, aLang: s.termLang, dir: d }
}

/** Falsche Antwortmöglichkeiten aus anderen Karten desselben Sets. */
export function distractors(s: StudySet, card: Card, dir: 'td' | 'dt', n: number, correct: string): string[] {
  const seen = new Set([normalize(correct)])
  const out: string[] = []
  for (const c of shuffle(usable(s).filter((x) => x.id !== card.id))) {
    const v = dir === 'td' ? c.definition : c.term
    const k = normalize(v)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(v)
    if (out.length >= n) break
  }
  return out
}

/** Sprachen für Begriff/Definition (steuern die Vorlesestimme); Anzeigenamen kommen aus Intl.DisplayNames */
export const TTS_LANGS = [
  'en-US', 'en-GB', 'de-DE', 'fr-FR', 'es-ES', 'it-IT', 'la', 'pt-PT', 'nl-NL', 'pl-PL',
  'ru-RU', 'tr-TR', 'sv-SE', 'da-DK', 'cs-CZ', 'el-GR', 'ja-JP', 'zh-CN', 'ko-KR', 'ar-SA'
]

export function speak(text: string, lang: string): void {
  if (!('speechSynthesis' in window) || !text) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text.replace(/\([^)]*\)/g, ''))
  // Latein hat keine eigene Stimme – Italienisch klingt am nächsten
  u.lang = lang === 'la' ? 'it-IT' : lang || 'en-US'
  speechSynthesis.speak(u)
}

export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
