/* Datenschicht: eine JSON-Datei, gemeinsam genutzt von Desktop-App und MCP-Server. */
import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import type { Card, CardInput, CardStats, ProgressResult, SetInput, SetSummary, StudySet } from './types'

interface Db { sets: StudySet[] }

/** %APPDATA%/Vokabeltrainer/db.json – derselbe Ordner, den Electron als userData nutzt. */
export function defaultDataFile(): string {
  if (process.env.QUIZ_DATA) return process.env.QUIZ_DATA
  const base =
    process.env.APPDATA ||
    (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : path.join(os.homedir(), '.config'))
  return path.join(base, 'Vokabeltrainer', 'db.json')
}

export const DATA_FILE = defaultDataFile()

const uid = () => crypto.randomBytes(6).toString('hex')
const now = () => new Date().toISOString()
const newStats = (): CardStats => ({ box: 0, correct: 0, wrong: 0, last: null })

function load(): Db {
  try {
    const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) as Db
    if (!Array.isArray(db.sets)) db.sets = []
    return db
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.error('db.json konnte nicht gelesen werden:', (e as Error).message)
    return { sets: [] }
  }
}

function save(db: Db): void {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
  const tmp = `${DATA_FILE}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2))
  fs.renameSync(tmp, DATA_FILE)
}

/** Lädt, ändert, speichert. Gibt fn `undefined` zurück, wird nicht gespeichert. */
function mutate<T>(fn: (db: Db) => T | undefined): T | undefined {
  const db = load()
  const result = fn(db)
  if (result !== undefined) save(db)
  return result
}

function cleanCard(c: CardInput, existing?: Card): Card {
  const card: Card = {
    id: existing?.id || c.id || uid(),
    term: String(c.term ?? '').trim(),
    definition: String(c.definition ?? '').trim(),
    starred: c.starred !== undefined ? !!c.starred : !!existing?.starred,
    stats: existing?.stats || newStats()
  }
  const ex = String(c.example ?? existing?.example ?? '').trim()
  if (ex) card.example = ex
  return card
}

export function summary(s: StudySet): SetSummary {
  const known = s.cards.filter((c) => c.stats.box >= 3).length
  const learning = s.cards.filter((c) => c.stats.box > 0 && c.stats.box < 3).length
  const { cards, tests, ...rest } = s
  void tests
  return { ...rest, folder: s.folder || '', count: cards.length, known, learning, fresh: cards.length - known - learning }
}

export function listSets(): SetSummary[] {
  return load()
    .sets.map(summary)
    .sort((a, b) => (b.lastStudied || b.updated).localeCompare(a.lastStudied || a.updated))
}

export function getSet(id: string): StudySet | null {
  return load().sets.find((s) => s.id === id) ?? null
}

export function createSet(data: SetInput): StudySet {
  return mutate((db) => {
    const s: StudySet = {
      id: uid(),
      title: String(data.title ?? '').trim() || 'New study set',
      description: String(data.description ?? '').trim(),
      termLang: data.termLang || 'en-US',
      defLang: data.defLang || 'de-DE',
      folder: String(data.folder ?? '').trim(),
      created: now(),
      updated: now(),
      lastStudied: null,
      cards: (data.cards ?? []).map((c) => cleanCard(c)).filter((c) => c.term || c.definition),
      tests: []
    }
    db.sets.push(s)
    return s
  })!
}

export function updateSet(id: string, data: SetInput): StudySet | null {
  return (
    mutate((db) => {
      const s = db.sets.find((x) => x.id === id)
      if (!s) return undefined
      if (data.title !== undefined) s.title = String(data.title).trim() || 'Untitled'
      if (data.description !== undefined) s.description = String(data.description).trim()
      if (data.termLang !== undefined) s.termLang = data.termLang
      if (data.defLang !== undefined) s.defLang = data.defLang
      if (data.folder !== undefined) s.folder = String(data.folder).trim()
      if (Array.isArray(data.cards)) {
        const byId = new Map(s.cards.map((c) => [c.id, c]))
        s.cards = data.cards.map((c) => cleanCard(c, c.id ? byId.get(c.id) : undefined)).filter((c) => c.term || c.definition)
      }
      s.updated = now()
      return s
    }) ?? null
  )
}

export function deleteSet(id: string): boolean {
  return (
    mutate((db) => {
      const n = db.sets.length
      db.sets = db.sets.filter((s) => s.id !== id)
      return db.sets.length === n ? undefined : true
    }) ?? false
  )
}

export function addCards(id: string, cards: CardInput[]): { set: StudySet; added: number } | null {
  return (
    mutate((db) => {
      const s = db.sets.find((x) => x.id === id)
      if (!s) return undefined
      const added = cards.map((c) => cleanCard(c)).filter((c) => c.term || c.definition)
      s.cards.push(...added)
      s.updated = now()
      return { set: s, added: added.length }
    }) ?? null
  )
}

export function updateCard(id: string, cardId: string, patch: Partial<CardInput> & { resetStats?: boolean }): Card | null {
  return (
    mutate((db) => {
      const c = db.sets.find((x) => x.id === id)?.cards.find((x) => x.id === cardId)
      if (!c) return undefined
      if (patch.term !== undefined) c.term = String(patch.term).trim()
      if (patch.definition !== undefined) c.definition = String(patch.definition).trim()
      if (patch.example !== undefined) c.example = String(patch.example).trim()
      if (!c.example) delete c.example
      if (patch.starred !== undefined) c.starred = !!patch.starred
      if (patch.resetStats) c.stats = newStats()
      return c
    }) ?? null
  )
}

export function deleteCard(id: string, cardId: string): boolean {
  return (
    mutate((db) => {
      const s = db.sets.find((x) => x.id === id)
      if (!s) return undefined
      const n = s.cards.length
      s.cards = s.cards.filter((c) => c.id !== cardId)
      if (s.cards.length === n) return undefined
      s.updated = now()
      return true
    }) ?? false
  )
}

/** Ergebnisse übernehmen: richtig = eine Stufe hoch, falsch = eine Stufe runter (0–4). */
export function recordProgress(id: string, results: ProgressResult[], test?: { score: number; total: number }): StudySet | null {
  return (
    mutate((db) => {
      const s = db.sets.find((x) => x.id === id)
      if (!s) return undefined
      const byId = new Map(s.cards.map((c) => [c.id, c]))
      for (const r of results ?? []) {
        const c = byId.get(r.cardId)
        if (!c) continue
        if (r.correct) { c.stats.correct++; c.stats.box = Math.min(4, c.stats.box + 1) }
        else { c.stats.wrong++; c.stats.box = Math.max(0, c.stats.box - 1) }
        c.stats.last = now()
      }
      s.lastStudied = now()
      if (test) s.tests = [...(s.tests ?? []), { date: now(), score: test.score, total: test.total }].slice(-30)
      return s
    }) ?? null
  )
}

export function resetProgress(id: string): StudySet | null {
  return (
    mutate((db) => {
      const s = db.sets.find((x) => x.id === id)
      if (!s) return undefined
      s.cards.forEach((c) => { c.stats = newStats() })
      return s
    }) ?? null
  )
}
