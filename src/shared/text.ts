/* Text-Import und Antwortprüfung – läuft in Oberfläche, Hauptprozess und MCP-Server */
import type { CardInput } from './types'

export type TermSep = 'auto' | 'tab' | 'comma' | 'semicolon' | 'dash' | string
export type CardSep = 'newline' | 'semicolon' | string

const HEADER_WORDS = new Set([
  'begriff', 'term', 'vokabel', 'wort', 'frage', 'definition', 'antwort', 'übersetzung', 'uebersetzung',
  'deutsch', 'englisch', 'english', 'german', 'französisch', 'franzoesisch', 'spanisch', 'latein', 'beispiel',
  'example', 'vorderseite', 'rückseite', 'rueckseite', 'front', 'back', 'translation', 'beispiel (optional)'
])

const NAMED: Record<string, string> = { tab: '\t', comma: ',', semicolon: ';', dash: ' - ' }

/** Erkennt das Trennzeichen zwischen Begriff und Definition. */
export function detectTermSep(lines: string[]): string {
  const sample = lines.filter((l) => l.trim()).slice(0, 20)
  if (!sample.length) return '\t'
  const half = Math.max(1, sample.length / 2)
  for (const d of ['\t', ';', ' - ', ' – ', '=', ':', ',']) {
    if (sample.filter((l) => l.includes(d)).length >= half) return d
  }
  return '\t'
}

function splitCells(line: string, delim: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') inQ = false
      else cur += c
    } else if (c === '"' && cur === '') inQ = true
    else if (line.startsWith(delim, i)) { out.push(cur); cur = ''; i += delim.length - 1 }
    else cur += c
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

/** Text → Zeilen aus Zellen. */
export function parseText(text: string, termSep: TermSep = 'auto', cardSep: CardSep = 'newline'): string[][] {
  text = String(text ?? '').replace(/^﻿/, '')
  const cs = cardSep === 'newline' ? /\r?\n/ : cardSep === 'semicolon' ? ';' : cardSep
  const lines = text.split(cs as string | RegExp).map((l) => l.replace(/^\r?\n|\r?\n$/g, ''))
  const ts = termSep === 'auto' ? detectTermSep(lines) : NAMED[termSep] ?? termSep
  return lines.filter((l) => l.trim()).map((l) => splitCells(l, ts || '\t'))
}

export function looksLikeHeader(row: string[] | undefined): boolean {
  if (!row || row.length < 2) return false
  return row.slice(0, 3).some((c) => HEADER_WORDS.has(String(c ?? '').trim().toLowerCase()))
}

/** Zeilen → Karten (Spalte 1 Begriff, 2 Definition, 3 Beispiel). header: 'auto' erkennt Überschriften. */
export function rowsToCards(rows: string[][], header: 'auto' | boolean = 'auto'): { cards: CardInput[]; header: string[] | null } {
  const list = rows.filter((r) => r && r.some((c) => String(c ?? '').trim() !== ''))
  const skip = header === 'auto' ? looksLikeHeader(list[0]) : header
  const head = skip && list.length ? list.shift()! : null
  const cards: CardInput[] = []
  for (const r of list) {
    const term = String(r[0] ?? '').trim()
    const definition = String(r[1] ?? '').trim()
    const example = String(r[2] ?? '').trim()
    if (!term && !definition) continue
    cards.push(example ? { term, definition, example } : { term, definition })
  }
  return { cards, header: head }
}

/* ---------- Antworten prüfen ---------- */

const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

export function normalize(s: string, keepAccents = false): string {
  let t = String(s ?? '').toLowerCase().trim()
  t = t.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ')
  t = t.replace(/[.,;:!?"'`´’‘“”„…¿¡/\\|*_~<>{}=+-]/g, ' ')
  t = t.replace(/\s+/g, ' ').trim()
  return keepAccents ? t : stripAccents(t)
}

export function alternatives(answer: string): string[] {
  const full = String(answer ?? '').trim()
  const parts = full.split(/\s*[;/|]\s*|\s*,\s*/).map((p) => p.trim()).filter(Boolean)
  return Array.from(new Set([full, ...parts]))
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

export type AnswerResult = 'correct' | 'typo' | 'wrong'

/** Vergleicht eine getippte Antwort. 'typo' = fast richtig (Tippfehler oder fehlender Akzent). */
export function checkAnswer(input: string, expected: string): AnswerResult {
  const given = normalize(input, true)
  if (!given) return 'wrong'
  const alts = alternatives(expected)
  for (const a of alts) if (normalize(a, true) === given) return 'correct'
  const parts = alts.slice(1)
  if (parts.length > 1) {
    const got = String(input).split(/\s*[;/|,]\s*/).map((p) => normalize(p, true)).filter(Boolean)
    const need = parts.map((p) => normalize(p, true))
    if (got.length === need.length && need.every((n) => got.includes(n))) return 'correct'
  }
  const g2 = normalize(input)
  for (const a of alts) {
    const n2 = normalize(a)
    if (n2 === g2) return 'typo'
    const maxDist = n2.length >= 9 ? 2 : n2.length >= 5 ? 1 : 0
    if (maxDist && levenshtein(n2, g2) <= maxDist) return 'typo'
  }
  return 'wrong'
}
