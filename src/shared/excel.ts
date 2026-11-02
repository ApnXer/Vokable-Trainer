/* Excel/CSV lesen und schreiben (nur im Hauptprozess bzw. MCP-Server) */
import * as XLSX from 'xlsx'
import { parseText } from './text'
import type { Sheet, StudySet } from './types'

/** Liest .xlsx/.xls/.ods direkt, .csv/.tsv/.txt als UTF-8-Text (Umlaute bleiben erhalten). */
export function readSpreadsheet(name: string, data: Buffer): Sheet[] {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['csv', 'tsv', 'txt'].includes(ext)) {
    return [{ name: name.replace(/\.[^.]+$/, ''), rows: parseText(data.toString('utf8')) }]
  }
  const wb = XLSX.read(data, { type: 'buffer' })
  return wb.SheetNames.map((sheetName) => ({
    name: sheetName,
    rows: (XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: false, blankrows: false }) as unknown[][]).map(
      (r) => r.map((c) => String(c ?? '').trim())
    )
  })).filter((s) => s.rows.length)
}

const rowsOf = (set: Pick<StudySet, 'cards'>) => [
  ['Term', 'Definition', 'Example'],
  ...set.cards.map((c) => [c.term, c.definition, c.example ?? ''])
]

export function setToXlsx(set: Pick<StudySet, 'title' | 'cards'>): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rowsOf(set))
  ws['!cols'] = [{ wch: 32 }, { wch: 40 }, { wch: 40 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, set.title.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Set')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

export function setToCsv(set: Pick<StudySet, 'cards'>, delim = ';'): string {
  const esc = (raw: string) => {
    // Formel-Injektion verhindern: Excel würde =, +, -, @ am Zellanfang als Formel ausführen
    const v = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
    return v.includes(delim) || /["\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  }
  return '﻿' + rowsOf(set).map((r) => r.map(esc).join(delim)).join('\r\n')
}

export function setToTxt(set: Pick<StudySet, 'cards'>): string {
  return set.cards.map((c) => `${c.term}\t${c.definition}`).join('\r\n')
}

export function templateXlsx(): Buffer {
  return setToXlsx({
    title: 'Vocabulary',
    cards: [
      { id: '1', term: 'the apple', definition: 'der Apfel', example: 'I eat an apple every day.', starred: false, stats: { box: 0, correct: 0, wrong: 0, last: null } },
      { id: '2', term: 'to run', definition: 'rennen', example: 'She runs to school.', starred: false, stats: { box: 0, correct: 0, wrong: 0, last: null } }
    ]
  })
}
