/* Ersatz für window.api, wenn die Oberfläche ohne Electron im Browser läuft (Entwicklung/Vorschau).
 * Speichert im localStorage; Dateidialoge gibt es hier nicht. */
import type { Api, Card, CardInput, SetInput, StudySet } from '@shared/types'
import { parseText } from '@shared/text'

const KEY = 'vt_browser_db'
const uid = () => Math.random().toString(16).slice(2, 14)
const now = () => new Date().toISOString()
const load = (): StudySet[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] } }
const save = (s: StudySet[]) => localStorage.setItem(KEY, JSON.stringify(s))
const toCard = (c: CardInput, old?: Card): Card => ({
  id: old?.id || c.id || uid(), term: c.term.trim(), definition: c.definition.trim(),
  ...(c.example?.trim() ? { example: c.example.trim() } : {}),
  starred: c.starred ?? old?.starred ?? false, stats: old?.stats ?? { box: 0, correct: 0, wrong: 0, last: null }
})

export function createBrowserApi(): Api {
  const withSet = <T>(id: string, fn: (s: StudySet, all: StudySet[]) => T): T | null => {
    const all = load()
    const s = all.find((x) => x.id === id)
    if (!s) return null
    const r = fn(s, all)
    save(all)
    return r
  }
  return {
    async listSets() {
      return load().map(({ cards, tests, ...s }) => {
        void tests
        const known = cards.filter((c) => c.stats.box >= 3).length
        const learning = cards.filter((c) => c.stats.box > 0 && c.stats.box < 3).length
        return { ...s, count: cards.length, known, learning, fresh: cards.length - known - learning }
      }).sort((a, b) => (b.lastStudied || b.updated).localeCompare(a.lastStudied || a.updated))
    },
    async getSet(id) { return load().find((s) => s.id === id) ?? null },
    async createSet(d: SetInput) {
      const s: StudySet = {
        id: uid(), title: d.title?.trim() || 'Neues Lernset', description: d.description ?? '', termLang: d.termLang ?? 'en-US', defLang: d.defLang ?? 'de-DE',
        folder: d.folder ?? '', created: now(), updated: now(), lastStudied: null, tests: [],
        cards: (d.cards ?? []).map((c) => toCard(c)).filter((c) => c.term || c.definition)
      }
      save([...load(), s])
      return s
    },
    async updateSet(id, d) {
      return withSet(id, (s) => {
        Object.assign(s, { ...d, cards: s.cards, updated: now() })
        if (d.cards) s.cards = d.cards.map((c) => toCard(c, s.cards.find((o) => o.id === c.id))).filter((c) => c.term || c.definition)
        return s
      })
    },
    async deleteSet(id) { const all = load(); save(all.filter((s) => s.id !== id)); return all.some((s) => s.id === id) },
    async addCards(id, cards) { return withSet(id, (s) => { const add = cards.map((c) => toCard(c)); s.cards.push(...add); return add.length }) ?? 0 },
    async updateCard(id, cardId, patch) {
      return withSet(id, (s) => { const c = s.cards.find((x) => x.id === cardId); if (c) Object.assign(c, patch); return c ?? null })
    },
    async recordProgress(id, results, test) {
      withSet(id, (s) => {
        for (const r of results) {
          const c = s.cards.find((x) => x.id === r.cardId)
          if (!c) continue
          if (r.correct) { c.stats.correct++; c.stats.box = Math.min(4, c.stats.box + 1) } else { c.stats.wrong++; c.stats.box = Math.max(0, c.stats.box - 1) }
          c.stats.last = now()
        }
        s.lastStudied = now()
        if (test) s.tests.push({ date: now(), ...test })
      })
    },
    async resetProgress(id) { withSet(id, (s) => s.cards.forEach((c) => { c.stats = { box: 0, correct: 0, wrong: 0, last: null } })) },
    async pickSpreadsheet() { return null },
    async readSpreadsheet(name, data) { return [{ name, rows: parseText(new TextDecoder().decode(data)) }] },
    async exportSet() { return null },
    async exportTemplate() { return null },
    async dataFile() { return 'Browser-Speicher (localStorage)' },
    onDataChanged() { return () => {} }
  }
}
