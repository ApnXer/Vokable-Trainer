import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { checkAnswer, parseText, rowsToCards } from '../src/shared/text'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vt-'))
process.env.QUIZ_DATA = path.join(tmp, 'db.json')

type Store = typeof import('../src/shared/store')
type Excel = typeof import('../src/shared/excel')
let store: Store
let excel: Excel

beforeAll(async () => {
  store = await import('../src/shared/store')
  excel = await import('../src/shared/excel')
})
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }))

describe('Text-Import', () => {
  it('erkennt Tab-getrennten Text aus Excel', () => {
    const { cards } = rowsToCards(parseText('apple\tder Apfel\nto run\trennen'))
    expect(cards.map((c) => c.term)).toEqual(['apple', 'to run'])
  })
  it('überspringt Überschriften und erkennt Semikolon', () => {
    const r = rowsToCards(parseText('Begriff;Definition\ncat;Katze\ndog;Hund'))
    expect(r.cards).toHaveLength(2)
    expect(r.header).toBeTruthy()
  })
  it('unterstützt Quizlet-Optionen: Komma zwischen Begriff/Definition, Semikolon zwischen Karten', () => {
    const { cards } = rowsToCards(parseText('cat,Katze;dog,Hund', 'comma', 'semicolon'))
    expect(cards).toEqual([{ term: 'cat', definition: 'Katze' }, { term: 'dog', definition: 'Hund' }])
  })
  it('eigenes Trennzeichen und Anführungszeichen', () => {
    expect(parseText('a => b', '=>')[0]).toEqual(['a', 'b'])
    expect(parseText('"a;b";c', 'semicolon', 'newline')[0][0]).toBe('a;b')
  })
})

describe('Antwortprüfung', () => {
  it('richtig, Tippfehler, falsch', () => {
    expect(checkAnswer('Apfel', 'der Apfel / Apfel')).toBe('correct')
    expect(checkAnswer('rennen', 'rennen (laufen)')).toBe('correct')
    expect(checkAnswer('b, a', 'a, b')).toBe('correct')
    expect(checkAnswer('beatiful', 'beautiful')).toBe('typo')
    expect(checkAnswer('cafe', 'café')).toBe('typo')
    expect(checkAnswer('Hund', 'Katze')).toBe('wrong')
    expect(checkAnswer('', 'x')).toBe('wrong')
  })
})

describe('Datenschicht', () => {
  it('Set anlegen, Fortschritt, Bearbeiten behält Statistik', () => {
    const s = store.createSet({ title: 'Englisch', cards: [{ term: 'cat', definition: 'Katze' }, { term: 'dog', definition: 'Hund' }] })
    const cid = s.cards[0].id
    store.recordProgress(s.id, [{ cardId: cid, correct: true }, { cardId: cid, correct: true }], { score: 1, total: 2 })
    const loaded = store.getSet(s.id)!
    expect(loaded.cards[0].stats.box).toBe(2)
    expect(loaded.tests).toHaveLength(1)
    loaded.cards[1].definition = 'Köter'
    const upd = store.updateSet(s.id, { cards: loaded.cards })!
    expect(upd.cards[0].stats.box).toBe(2)
    expect(upd.cards[1].definition).toBe('Köter')
    expect(store.listSets()[0].learning).toBe(1)
  })
  it('Karten anhängen, markieren, löschen', () => {
    const s = store.createSet({ title: 'X', cards: [{ term: 'a', definition: 'b' }] })
    expect(store.addCards(s.id, [{ term: 'c', definition: 'd' }])!.added).toBe(1)
    expect(store.updateCard(s.id, s.cards[0].id, { starred: true })!.starred).toBe(true)
    expect(store.deleteCard(s.id, s.cards[0].id)).toBe(true)
    expect(store.getSet(s.id)!.cards).toHaveLength(1)
    expect(store.deleteSet(s.id)).toBe(true)
    expect(store.getSet('gibtsnicht')).toBeNull()
  })
})

describe('Excel', () => {
  it('Export und Import ergeben dieselben Karten', () => {
    const buf = excel.setToXlsx({ title: 'T', cards: store.createSet({ title: 'T', cards: [{ term: 'a', definition: 'b', example: 'c' }] }).cards })
    const sheets = excel.readSpreadsheet('t.xlsx', buf)
    expect(rowsToCards(sheets[0].rows).cards).toEqual([{ term: 'a', definition: 'b', example: 'c' }])
  })
  it('CSV-Export entschärft Formeln und liest sie unverändert wieder ein', () => {
    const cards = store.createSet({ title: 'F', cards: [{ term: '=HYPERLINK("x")', definition: '-ly' }] }).cards
    const csv = excel.setToCsv({ cards })
    expect(csv).toContain(`'-ly`)
    expect(csv).not.toMatch(/(^|;)"?=/m)
    const back = rowsToCards(excel.readSpreadsheet('f.csv', Buffer.from(csv, 'utf8'))[0].rows).cards
    expect(back[0]).toEqual({ term: '=HYPERLINK("x")', definition: '-ly' })
  })
  it('CSV mit Umlauten wird als UTF-8 gelesen', () => {
    const sheets = excel.readSpreadsheet('v.csv', Buffer.from('Begriff;Definition\nbeautiful;schön\n', 'utf8'))
    expect(rowsToCards(sheets[0].rows).cards[0].definition).toBe('schön')
  })
})

describe('MCP-Server (gebaute Datei)', () => {
  it('Tools funktionieren und teilen die Daten mit der App', async () => {
    const bundle = path.join(__dirname, '..', 'dist-mcp', 'mcp-server.cjs')
    expect(fs.existsSync(bundle), 'erst "npm run build:mcp" ausführen').toBe(true)
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
    const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js')
    const client = new Client({ name: 'test', version: '1' })
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [bundle], env: { ...process.env } as Record<string, string> }))
    const call = async (name: string, args: Record<string, unknown>) => {
      const r = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content: { text: string }[] }
      let data: any
      try { data = JSON.parse(r.content[0].text) } catch { data = r.content[0].text }
      return { err: !!r.isError, data }
    }
    const names = (await client.listTools()).tools.map((t) => t.name)
    expect(names).toEqual(expect.arrayContaining(['list_sets', 'get_set', 'create_set', 'add_cards', 'import_text', 'search_cards', 'study_stats', 'export_set']))
    const id = (await call('create_set', { title: 'Französisch', cards: [{ term: 'chat', definition: 'Katze' }] })).data.setId
    expect((await call('import_text', { setId: id, text: 'chien\tHund\nlivre\tBuch' })).data.added).toBe(2)
    expect((await call('search_cards', { query: 'buch' })).data.count).toBe(1)
    expect(store.getSet(id)!.cards).toHaveLength(3)
    expect((await call('get_set', { setId: 'nope' })).err).toBe(true)
    await client.close()
  })
})
