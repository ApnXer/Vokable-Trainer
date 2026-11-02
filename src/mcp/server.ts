/* MCP-Server (stdio): gibt Claude Zugriff auf alle Lernsets der Desktop-App.
 * Gebaut nach dist-mcp/mcp-server.cjs (eine Datei, keine node_modules nötig). */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import * as store from '../shared/store'
import * as excel from '../shared/excel'
import { parseText, rowsToCards } from '../shared/text'
import type { Card } from '../shared/types'

const server = new McpServer({ name: 'vocab-trainer', version: '2.1.0' })

const ok = (obj: unknown) => ({ content: [{ type: 'text' as const, text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }] })
const fail = (msg: string) => ({ isError: true, content: [{ type: 'text' as const, text: msg }] })

const cardIn = z.object({
  term: z.string().describe('Term / front side (e.g. the English word)'),
  definition: z.string().describe('Definition / back side (e.g. the translation)'),
  example: z.string().optional().describe('Optional example sentence')
})

const slim = (c: Card) => ({ id: c.id, term: c.term, definition: c.definition, example: c.example, starred: c.starred, level: c.stats.box })

server.registerTool('list_sets', { description: 'List all study sets with id, title, folder, card count and progress.', inputSchema: {} }, async () =>
  ok(store.listSets())
)

server.registerTool('get_set', { description: 'Return one study set with all of its cards.', inputSchema: { setId: z.string() } }, async ({ setId }) => {
  const s = store.getSet(setId)
  return s ? ok({ ...store.summary(s), cards: s.cards.map(slim) }) : fail('Set not found: ' + setId)
})

server.registerTool(
  'create_set',
  {
    description: 'Create a new study set, optionally with cards. Language codes (BCP-47) control text-to-speech, e.g. en-US, de-DE, fr-FR, es-ES, la.',
    inputSchema: {
      title: z.string(),
      description: z.string().optional(),
      termLang: z.string().optional().describe('Language of the terms, e.g. en-US'),
      defLang: z.string().optional().describe('Language of the definitions, e.g. de-DE'),
      folder: z.string().optional().describe('Folder / subject, e.g. English'),
      cards: z.array(cardIn).optional()
    }
  },
  async (args) => {
    const s = store.createSet(args)
    return ok({ ok: true, setId: s.id, cards: s.cards.length })
  }
)

server.registerTool(
  'update_set',
  {
    description: 'Change the title, description, languages or folder of a study set.',
    inputSchema: {
      setId: z.string(), title: z.string().optional(), description: z.string().optional(),
      termLang: z.string().optional(), defLang: z.string().optional(), folder: z.string().optional()
    }
  },
  async ({ setId, ...patch }) => {
    const s = store.updateSet(setId, patch)
    return s ? ok({ ok: true, ...store.summary(s) }) : fail('Set not found')
  }
)

server.registerTool('delete_set', { description: 'Permanently delete a study set.', inputSchema: { setId: z.string() } }, async ({ setId }) =>
  store.deleteSet(setId) ? ok({ ok: true }) : fail('Set not found')
)

server.registerTool(
  'add_cards',
  { description: 'Add several cards to a study set.', inputSchema: { setId: z.string(), cards: z.array(cardIn).min(1) } },
  async ({ setId, cards }) => {
    const r = store.addCards(setId, cards)
    return r ? ok({ ok: true, added: r.added, total: r.set.cards.length }) : fail('Set not found')
  }
)

server.registerTool(
  'import_text',
  {
    description:
      'Import cards from raw text, one card per line. Separators (tab as copied from Excel, semicolon, " - ", comma, =) are detected. With setId the cards are appended, otherwise a new set named title is created.',
    inputSchema: {
      text: z.string(),
      setId: z.string().optional(),
      title: z.string().optional(),
      separator: z.string().optional().describe("'auto' (default), 'tab', 'comma', 'semicolon', 'dash' or a custom string"),
      termLang: z.string().optional(),
      defLang: z.string().optional()
    }
  },
  async ({ text, setId, title, separator, termLang, defLang }) => {
    const { cards } = rowsToCards(parseText(text, separator ?? 'auto'))
    if (!cards.length) return fail('No cards found in the text.')
    if (setId) {
      const r = store.addCards(setId, cards)
      return r ? ok({ ok: true, added: r.added, setId }) : fail('Set not found')
    }
    const s = store.createSet({ title: title || 'Imported study set', termLang, defLang, cards })
    return ok({ ok: true, setId: s.id, cards: s.cards.length })
  }
)

server.registerTool(
  'update_card',
  {
    description: 'Edit one card (term, definition, example, star).',
    inputSchema: {
      setId: z.string(), cardId: z.string(), term: z.string().optional(), definition: z.string().optional(),
      example: z.string().optional(), starred: z.boolean().optional()
    }
  },
  async ({ setId, cardId, ...patch }) => {
    const c = store.updateCard(setId, cardId, patch)
    return c ? ok({ ok: true, card: slim(c) }) : fail('Card not found')
  }
)

server.registerTool('delete_card', { description: 'Delete one card.', inputSchema: { setId: z.string(), cardId: z.string() } }, async ({ setId, cardId }) =>
  store.deleteCard(setId, cardId) ? ok({ ok: true }) : fail('Card not found')
)

server.registerTool(
  'search_cards',
  { description: 'Search terms, definitions and examples across all sets (or within one set).', inputSchema: { query: z.string(), setId: z.string().optional() } },
  async ({ query, setId }) => {
    const q = query.toLowerCase()
    const hits = []
    for (const sum of store.listSets()) {
      if (setId && sum.id !== setId) continue
      const s = store.getSet(sum.id)!
      for (const c of s.cards) {
        if ([c.term, c.definition, c.example ?? ''].some((x) => x.toLowerCase().includes(q))) hits.push({ setId: s.id, setTitle: s.title, ...slim(c) })
      }
    }
    return ok({ count: hits.length, hits: hits.slice(0, 100) })
  }
)

server.registerTool(
  'study_stats',
  { description: 'Progress of a set: new / learning / known, the hardest cards and recent test results.', inputSchema: { setId: z.string() } },
  async ({ setId }) => {
    const s = store.getSet(setId)
    if (!s) return fail('Set not found')
    const hardest = s.cards
      .filter((c) => c.stats.wrong > 0)
      .sort((a, b) => b.stats.wrong - b.stats.correct - (a.stats.wrong - a.stats.correct))
      .slice(0, 10)
      .map((c) => ({ ...slim(c), correct: c.stats.correct, wrong: c.stats.wrong }))
    return ok({ ...store.summary(s), hardest, tests: s.tests })
  }
)

server.registerTool(
  'export_set',
  { description: 'Export a set as CSV (semicolon) or tab-separated text.', inputSchema: { setId: z.string(), format: z.enum(['csv', 'txt']).optional() } },
  async ({ setId, format }) => {
    const s = store.getSet(setId)
    if (!s) return fail('Set not found')
    return ok(format === 'txt' ? excel.setToTxt(s) : excel.setToCsv(s))
  }
)

server
  .connect(new StdioServerTransport())
  .then(() => console.error('Vocab Trainer MCP ready. Data:', store.DATA_FILE))
