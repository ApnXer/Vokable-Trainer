import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftRight, Plus, Trash2, Upload } from 'lucide-react'
import type { CardInput } from '@shared/types'
import { parseText } from '@shared/text'
import { useAppState, useSet, useSets } from '../lib/app-state'
import { TTS_LANGS } from '../lib/study'
import { languageName, useT } from '../lib/settings'
import ImportDialog from '../components/ImportDialog'

interface Row { key: number; id?: string; term: string; definition: string; example: string; showEx: boolean }
type Field = 'term' | 'definition' | 'example'
const FIELDS: Field[] = ['term', 'definition', 'example']

let keySeq = 1
const blank = (): Row => ({ key: keySeq++, term: '', definition: '', example: '', showEx: false })
const isBlank = (r: Row) => !r.term.trim() && !r.definition.trim() && !r.example.trim()

export default function EditSet() {
  const { id } = useParams()
  const isNew = !id
  const location = useLocation()
  const state = (location.state ?? {}) as { openImport?: boolean; folder?: string }
  const navigate = useNavigate()
  const { toast, refresh } = useAppState()
  const { t, tn, lang } = useT()
  const [existing] = useSet(id, false)
  const sets = useSets()
  const folders = [...new Set((sets ?? []).map((s) => s.folder).filter(Boolean))]

  const [meta, setMeta] = useState({ title: '', description: '', termLang: 'en-US', defLang: 'de-DE', folder: state.folder ?? '' })
  const [rows, setRows] = useState<Row[]>(() => (isNew ? [blank(), blank(), blank(), blank(), blank()] : []))
  const [showImport, setShowImport] = useState(!!state.openImport)
  const [saving, setSaving] = useState(false)
  const dirty = useRef(false)
  const focusNext = useRef<{ key: number; field: Field } | null>(null)

  useEffect(() => {
    if (!existing) return
    setMeta({ title: existing.title, description: existing.description, termLang: existing.termLang, defLang: existing.defLang, folder: existing.folder })
    const rs = existing.cards.map((c) => ({ key: keySeq++, id: c.id, term: c.term, definition: c.definition, example: c.example ?? '', showEx: !!c.example }))
    setRows(rs.length ? [...rs, blank()] : [blank(), blank(), blank()])
  }, [existing])

  useEffect(() => {
    const f = focusNext.current
    if (!f) return
    focusNext.current = null
    document.querySelector<HTMLElement>(`[data-key="${f.key}"][data-field="${f.field}"]`)?.focus()
  })

  const touch = () => { dirty.current = true }
  const setField = (key: number, field: Field, value: string) => {
    touch()
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)))
  }

  /** Mehrere Zeilen/Spalten aus Excel einfügen: ab der aktuellen Karte verteilen */
  const onPaste = (e: ClipboardEvent<HTMLElement>, key: number, field: Field) => {
    const text = e.clipboardData.getData('text').replace(/\r?\n$/, '')
    if (!/[\t\n]/.test(text)) return
    e.preventDefault()
    const data = parseText(text, 'tab', 'newline')
    touch()
    setRows((rs) => {
      const next = [...rs]
      const start = next.findIndex((r) => r.key === key)
      const col = FIELDS.indexOf(field)
      data.forEach((cells, i) => {
        if (!next[start + i]) next.splice(start + i, 0, blank())
        const r = { ...next[start + i] }
        cells.forEach((v, j) => {
          const f = FIELDS[col + j]
          if (f) { r[f] = v; if (f === 'example' && v) r.showEx = true }
        })
        next[start + i] = r
      })
      if (!isBlank(next[next.length - 1])) next.push(blank())
      return next
    })
    toast(tn(data.length, '{n} row pasted', '{n} rows pasted'))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLElement>, idx: number, field: Field) => {
    if (e.key !== 'Enter' || e.shiftKey) return
    e.preventDefault()
    if (idx === rows.length - 1) {
      const r = blank()
      setRows((rs) => [...rs, r])
      focusNext.current = { key: r.key, field }
    } else {
      focusNext.current = { key: rows[idx + 1].key, field }
      setRows((rs) => [...rs])
    }
  }

  const importCards = (cards: CardInput[], suggestedTitle?: string) => {
    touch()
    setRows((rs) => [
      ...rs.filter((r) => !isBlank(r)),
      ...cards.map((c) => ({ ...blank(), term: c.term, definition: c.definition, example: c.example ?? '', showEx: !!c.example })),
      blank()
    ])
    if (suggestedTitle && !meta.title) setMeta((m) => ({ ...m, title: suggestedTitle }))
    setShowImport(false)
    toast(tn(cards.length, '{n} card imported – now save', '{n} cards imported – now save'))
  }

  const save = async () => {
    const cards = rows.filter((r) => !isBlank(r))
    if (!meta.title.trim()) {
      toast(t('Please enter a title'))
      document.getElementById('set-title')?.focus()
      return
    }
    const half = cards.filter((c) => !c.term.trim() || !c.definition.trim()).length
    if (half && !confirm(tn(half, '{n} card has only one side and cannot be studied. Save anyway?', '{n} cards have only one side and cannot be studied. Save anyway?'))) return
    setSaving(true)
    const payload = { ...meta, cards: cards.map((r) => ({ id: r.id, term: r.term, definition: r.definition, example: r.example })) }
    const saved = isNew ? await window.api.createSet(payload) : await window.api.updateSet(id!, payload)
    dirty.current = false
    refresh()
    toast(isNew ? t('Study set created') : t('Saved'))
    navigate(`/set/${saved!.id}`, { replace: true })
  }

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const cancel = () => {
    if (dirty.current && !confirm(t('Discard unsaved changes?'))) return
    if (isNew) navigate(-1)
    else navigate(`/set/${id}`)
  }

  if (!isNew && existing === undefined) return null
  if (!isNew && existing === null) return <div className="page-inner"><div className="empty"><h2>{t('Study set not found')}</h2></div></div>
  const count = rows.filter((r) => !isBlank(r)).length
  const langOptions = TTS_LANGS.map((c) => <option key={c} value={c}>{languageName(c, lang)}</option>)

  return (
    <div className="page-inner">
      <div className="editor-bar">
        <h1>{isNew ? t('Create a new study set') : t('Edit study set')}</h1>
        <button className="btn" onClick={cancel}>{isNew ? t('Cancel') : t('Back to set')}</button>
        <button className="btn btn-primary" onClick={save} disabled={saving} title="Ctrl+S">{isNew ? t('Create') : t('Done')}</button>
      </div>

      <div className="meta-card">
        <label className="underline-field span title-input">
          <input id="set-title" value={meta.title} onChange={(e) => { touch(); setMeta({ ...meta, title: e.target.value }) }} placeholder={t('Enter a title, e.g. “English – Unit 3”')} autoFocus={!state.openImport} />
          <span className="field-label">{t('Title')}</span>
        </label>
        <label className="underline-field span">
          <textarea rows={1} value={meta.description} onChange={(e) => { touch(); setMeta({ ...meta, description: e.target.value }) }} placeholder={t('Add a description …')} />
          <span className="field-label">{t('Description')}</span>
        </label>
        <label className="field">
          <span className="field-label">{t('Term language')}</span>
          <select className="select" value={meta.termLang} onChange={(e) => { touch(); setMeta({ ...meta, termLang: e.target.value }) }}>{langOptions}</select>
        </label>
        <label className="field">
          <span className="field-label">{t('Definition language')}</span>
          <select className="select" value={meta.defLang} onChange={(e) => { touch(); setMeta({ ...meta, defLang: e.target.value }) }}>{langOptions}</select>
        </label>
        <label className="field">
          <span className="field-label">{t('Folder (optional)')}</span>
          <input className="input" list="folder-list" value={meta.folder} onChange={(e) => { touch(); setMeta({ ...meta, folder: e.target.value }) }} placeholder={t('e.g. English')} />
          <datalist id="folder-list">{folders.map((f) => <option key={f} value={f} />)}</datalist>
        </label>
      </div>

      <div className="editor-tools">
        <button className="btn" onClick={() => setShowImport(true)}><Upload size={18} /> {t('Import')}</button>
        <button
          className="btn btn-ghost"
          onClick={() => {
            touch()
            setRows((rs) => rs.map((r) => ({ ...r, term: r.definition, definition: r.term })))
            setMeta((m) => ({ ...m, termLang: m.defLang, defLang: m.termLang }))
          }}
        >
          <ArrowLeftRight size={18} /> {t('Swap terms and definitions')}
        </button>
        <span className="spacer" />
        <span className="muted small">{t('Tip: copy cells in Excel and paste them into a card with')} <kbd>Ctrl</kbd>+<kbd>V</kbd></span>
      </div>

      {rows.map((r, idx) => (
        <div key={r.key} className="edit-card">
          <div className="edit-card-head">
            <span className="num">{idx + 1}</span>
            {!r.showEx && (
              <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => { setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, showEx: true } : x))); focusNext.current = { key: r.key, field: 'example' } }}>
                <Plus size={15} /> {t('Example sentence')}
              </button>
            )}
            <button className="icon-btn" onClick={() => { touch(); setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [blank()])) }} aria-label={t('Delete card {n}', { n: idx + 1 })} title={t('Delete card')}>
              <Trash2 size={18} />
            </button>
          </div>
          <div className="edit-card-body">
            {(['term', 'definition'] as const).map((f) => (
              <label key={f} className="underline-field">
                <input
                  data-key={r.key}
                  data-field={f}
                  value={r[f]}
                  onChange={(e) => setField(r.key, f, e.target.value)}
                  onPaste={(e) => onPaste(e, r.key, f)}
                  onKeyDown={(e) => onKeyDown(e, idx, f)}
                  aria-label={`${f === 'term' ? t('Term') : t('Definition')} ${idx + 1}`}
                />
                <span className="field-label">{f === 'term' ? t('Term') : t('Definition')}</span>
              </label>
            ))}
            {r.showEx && (
              <label className="underline-field ex-row">
                <input
                  data-key={r.key}
                  data-field="example"
                  value={r.example}
                  onChange={(e) => setField(r.key, 'example', e.target.value)}
                  onKeyDown={(e) => onKeyDown(e, idx, 'example')}
                  aria-label={`${t('Example sentence')} ${idx + 1}`}
                />
                <span className="field-label">{t('Example sentence')}</span>
              </label>
            )}
          </div>
        </div>
      ))}

      <button className="add-card" onClick={() => { const b = blank(); setRows((rs) => [...rs, b]); focusNext.current = { key: b.key, field: 'term' } }}>
        <span>+ {t('Add card')}</span>
      </button>

      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 24 }}>
        <span className="muted">{tn(count, '{n} card', '{n} cards')}</span>
        <button className="btn btn-primary btn-lg" onClick={save} disabled={saving}>{isNew ? t('Create') : t('Done')}</button>
      </div>

      {showImport && <ImportDialog onClose={() => setShowImport(false)} onImport={importCards} />}
    </div>
  )
}
