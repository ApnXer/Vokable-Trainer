import { useMemo, useState, type DragEvent } from 'react'
import { FileSpreadsheet, FileDown } from 'lucide-react'
import type { CardInput, Sheet } from '@shared/types'
import { parseText, rowsToCards } from '@shared/text'
import { Dialog } from './ui'
import { useAppState } from '../lib/app-state'
import { useT } from '../lib/settings'

type TermSep = 'auto' | 'tab' | 'comma' | 'custom'
type CardSep = 'newline' | 'semicolon' | 'custom'

const sheetToText = (s: Sheet) => s.rows.map((r) => r.map((c) => c.replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n')

/** Import wie bei Quizlet: Text einfügen (z. B. aus Excel kopiert) oder Excel-Datei öffnen, Trennzeichen wählen, Vorschau prüfen. */
export default function ImportDialog({ onClose, onImport }: { onClose(): void; onImport(cards: CardInput[], suggestedTitle?: string): void }) {
  const { toast } = useAppState()
  const { t, tn } = useT()
  const [text, setText] = useState('')
  const [termSep, setTermSep] = useState<TermSep>('auto')
  const [customTerm, setCustomTerm] = useState('-')
  const [cardSep, setCardSep] = useState<CardSep>('newline')
  const [customCard, setCustomCard] = useState('\\n\\n')
  const [header, setHeader] = useState<'auto' | 'yes' | 'no'>('auto')
  const [sheets, setSheets] = useState<Sheet[] | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [over, setOver] = useState(false)

  const parsed = useMemo(() => {
    const ts = termSep === 'custom' ? customTerm : termSep
    const cs = cardSep === 'custom' ? customCard.replace(/\\n/g, '\n').replace(/\\t/g, '\t') : cardSep
    const rows = parseText(text, ts || 'auto', cs || 'newline')
    return rowsToCards(rows, header === 'auto' ? 'auto' : header === 'yes')
  }, [text, termSep, customTerm, cardSep, customCard, header])

  const loadSheets = (name: string, list: Sheet[]) => {
    if (!list.length) { toast(t('No data found in this file')); return }
    setSheets(list)
    setFileName(name.replace(/\.[^.]+$/, ''))
    setText(sheetToText(list[0]))
    setTermSep('tab')
    setCardSep('newline')
  }
  const pickFile = async () => {
    const r = await window.api.pickSpreadsheet()
    if (r) loadSheets(r.name, r.sheets)
  }
  const onDrop = async (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    const f = e.dataTransfer.files[0]
    if (!f) return
    try { loadSheets(f.name, await window.api.readSpreadsheet(f.name, await f.arrayBuffer())) }
    catch { toast(t('This file could not be read')) }
  }

  const n = parsed.cards.length
  return (
    <Dialog
      title={t('Import data')}
      wide
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => window.api.exportTemplate()}><FileDown size={18} /> {t('Save Excel template')}</button>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>{t('Cancel')}</button>
          <button className="btn btn-primary" disabled={!n} onClick={() => onImport(parsed.cards, fileName ?? undefined)}>
            {n ? tn(n, 'Import {n} card', 'Import {n} cards') : t('Import')}
          </button>
        </>
      }
    >
      <div onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
        <p className="muted" style={{ marginTop: 0 }}>
          {t('Copy your vocabulary from Excel, Word or Google Docs and paste it here, or open an Excel file. Column A becomes the term, column B the definition, column C (optional) an example sentence.')}
        </p>
        <textarea
          className="textarea"
          rows={8}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('Word 1\tDefinition 1\nWord 2\tDefinition 2\nWord 3\tDefinition 3')}
          aria-label={t('Data to import')}
          spellCheck={false}
        />
        <div className={`drop-hint ${over ? 'over' : ''}`}>
          <button className="btn" onClick={pickFile}><FileSpreadsheet size={18} /> {t('Open Excel file')}</button>
          <span style={{ marginLeft: 12 }}>{t('or drop a file here (.xlsx, .xls, .ods, .csv)')}</span>
          {sheets && sheets.length > 1 && (
            <div className="row" style={{ justifyContent: 'center', marginTop: 10 }}>
              <span>{t('Sheet:')}</span>
              <select className="select" style={{ width: 240 }} onChange={(e) => setText(sheetToText(sheets[Number(e.target.value)]))} aria-label={t('Sheet:')}>
                {sheets.map((s, i) => <option key={s.name} value={i}>{s.name} ({tn(s.rows.length, '{n} row', '{n} rows')})</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="import-opts">
          <div>
            <h3 style={{ marginBottom: 8 }}>{t('Between term and definition')}</h3>
            <div className="radio-list">
              {([['auto', 'Detect automatically'], ['tab', 'Tab (copied from Excel)'], ['comma', 'Comma']] as const).map(([v, l]) => (
                <label key={v}><input type="radio" name="ts" checked={termSep === v} onChange={() => setTermSep(v)} /> {t(l)}</label>
              ))}
              <label>
                <input type="radio" name="ts" checked={termSep === 'custom'} onChange={() => setTermSep('custom')} /> {t('Custom')}
                <input className="input" value={customTerm} onChange={(e) => { setCustomTerm(e.target.value); setTermSep('custom') }} aria-label={t('Custom separator')} />
              </label>
            </div>
          </div>
          <div>
            <h3 style={{ marginBottom: 8 }}>{t('Between cards')}</h3>
            <div className="radio-list">
              {([['newline', 'New line'], ['semicolon', 'Semicolon']] as const).map(([v, l]) => (
                <label key={v}><input type="radio" name="cs" checked={cardSep === v} onChange={() => setCardSep(v)} /> {t(l)}</label>
              ))}
              <label>
                <input type="radio" name="cs" checked={cardSep === 'custom'} onChange={() => setCardSep('custom')} /> {t('Custom')}
                <input className="input" value={customCard} onChange={(e) => { setCustomCard(e.target.value); setCardSep('custom') }} aria-label={t('Custom card separator')} />
              </label>
            </div>
            <label className="check" style={{ marginTop: 10 }}>
              <input type="checkbox" checked={header === 'yes' || (header === 'auto' && !!parsed.header)} onChange={(e) => setHeader(e.target.checked ? 'yes' : 'no')} />
              {t('First row is a header')}
            </label>
          </div>
        </div>

        <div className="import-preview">
          <h3 style={{ marginBottom: 8 }}>{t('Preview')} · {tn(n, '{n} card', '{n} cards')}</h3>
          {n ? (
            <div className="terms">
              {parsed.cards.slice(0, 100).map((c, i) => (
                <div key={i} className="term-row">
                  <div className="t">{c.term || <span className="muted">{t('(empty)')}</span>}</div>
                  <div className="d">{c.definition || <span className="muted">{t('(empty)')}</span>}{c.example && <div className="ex">{c.example}</div>}</div>
                  <div />
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">{t('Nothing detected yet. Paste text above.')}</p>
          )}
        </div>
      </div>
    </Dialog>
  )
}
