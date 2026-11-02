import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, Ellipsis, Folder, Maximize2, Pencil, RotateCcw, Shuffle, Star, Trash2, Volume2 } from 'lucide-react'
import type { Card, ExportFormat, StudySet } from '@shared/types'
import { useAppState, useSet } from '../lib/app-state'
import { shuffle as shuffleArr, speak } from '../lib/study'
import { languageName, useT } from '../lib/settings'
import { flipKey, nextKey, prevKey, typingTarget } from '../lib/keys'
import Flashcard from '../components/Flashcard'
import { MODES } from '../components/StudyHeader'
import { Menu, StatusBar } from '../components/ui'

type Sort = 'original' | 'alpha' | 'status'

export default function SetPage() {
  const { id = '' } = useParams()
  const [set, setSet] = useSet(id)
  const navigate = useNavigate()
  const { toast, refresh } = useAppState()
  const { t, tn, lang } = useT()

  if (set === undefined) return null
  if (set === null) {
    return (
      <div className="page-inner"><div className="empty" style={{ marginTop: 40 }}><h2>{t('Study set not found')}</h2><p>{t('It may have been deleted.')}</p><Link className="btn" to="/">{t('Back to home')}</Link></div></div>
    )
  }

  const known = set.cards.filter((c) => c.stats.box >= 3).length
  const learning = set.cards.filter((c) => c.stats.box > 0 && c.stats.box < 3).length

  const toggleStar = async (c: Card) => {
    const starred = !c.starred
    setSet({ ...set, cards: set.cards.map((x) => (x.id === c.id ? { ...x, starred } : x)) })
    await window.api.updateCard(set.id, c.id, { starred })
  }
  const exportAs = async (f: ExportFormat) => {
    const p = await window.api.exportSet(set.id, f)
    if (p) toast(t('Exported'))
  }
  const remove = async () => {
    if (!confirm(t('Delete “{title}” permanently? This cannot be undone.', { title: set.title }))) return
    await window.api.deleteSet(set.id)
    refresh()
    toast(t('Study set deleted'))
    navigate('/library')
  }
  const reset = async () => {
    if (!confirm(t('Reset your progress for this set?'))) return
    await window.api.resetProgress(set.id)
    refresh()
    toast(t('Progress reset'))
  }
  const formatName: Record<ExportFormat, string> = { xlsx: 'Excel', csv: 'CSV', txt: t('Text'), json: 'JSON' }

  return (
    <div className="page-inner">
      <div className="set-head">
        <h1>{set.title}</h1>
        <button className="btn" onClick={() => navigate(`/set/${set.id}/edit`)}><Pencil size={16} /> {t('Edit')}</button>
        <Menu button={(toggle) => <button className="icon-btn outlined" onClick={toggle} aria-label={t('More actions')}><Ellipsis size={20} /></button>}>
          {(close) => (
            <>
              {(['xlsx', 'csv', 'txt', 'json'] as ExportFormat[]).map((f) => (
                <button key={f} onClick={() => { close(); exportAs(f) }}>
                  <Download size={18} /> {t('Export as {format}', { format: formatName[f] })}
                </button>
              ))}
              <hr />
              <button onClick={() => { close(); reset() }}><RotateCcw size={18} /> {t('Reset progress')}</button>
              <button className="danger" onClick={() => { close(); remove() }}><Trash2 size={18} /> {t('Delete study set')}</button>
            </>
          )}
        </Menu>
      </div>
      <div className="set-sub">
        <span>{tn(set.cards.length, '{n} term', '{n} terms')}</span>
        <span>{languageName(set.termLang, lang)} → {languageName(set.defLang, lang)}</span>
        {set.folder && <Link to={`/folder/${encodeURIComponent(set.folder)}`} className="row" style={{ gap: 6 }}><Folder size={15} /> {set.folder}</Link>}
      </div>

      <nav className="modes" aria-label={t('Study modes')}>
        {MODES.map(({ key, label, Icon }) => (
          <button key={key} className="mode-btn" onClick={() => navigate(`/set/${set.id}/${key}`)} disabled={!set.cards.length}>
            <Icon size={24} /> {t(label)}
          </button>
        ))}
      </nav>

      {set.cards.length > 0 ? <Preview set={set} /> : (
        <div className="empty"><h2>{t('No cards yet')}</h2><p>{t('Add terms or import them from Excel.')}</p><button className="btn btn-primary" onClick={() => navigate(`/set/${set.id}/edit`)}>{t('Add terms')}</button></div>
      )}

      {set.description && <p style={{ marginTop: 28, maxWidth: '70ch', whiteSpace: 'pre-wrap' }}>{set.description}</p>}

      <div className="set-meta">
        <StatusBar known={known} learning={learning} total={set.cards.length} />
        <div className="legend">
          <span className="lk">{t('{k} known', { k: known })}</span>
          <span className="ll">{t('{l} still learning', { l: learning })}</span>
          <span>{t('{n} not studied', { n: set.cards.length - known - learning })}</span>
        </div>
      </div>

      <TermList set={set} onStar={toggleStar} onSaved={(s) => setSet(s)} />

      <div style={{ textAlign: 'center', marginTop: 28 }}>
        <button className="btn btn-primary btn-lg" onClick={() => navigate(`/set/${set.id}/edit`)}>{t('Add or remove terms')}</button>
      </div>
    </div>
  )
}

/** Große Karteikarten-Vorschau unter den Modus-Buttons (wie bei Quizlet) */
function Preview({ set }: { set: StudySet }) {
  const navigate = useNavigate()
  const { t } = useT()
  const [order, setOrder] = useState(() => set.cards.map((c) => c.id))
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [mixed, setMixed] = useState(false)
  const [anim, setAnim] = useState('')

  useEffect(() => { setOrder(set.cards.map((c) => c.id)); setI(0) }, [set.cards.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const card = set.cards.find((c) => c.id === order[i]) ?? set.cards[0]
  const go = (d: number) => {
    setI((x) => (x + d + order.length) % order.length)
    setFlipped(false)
    setAnim(d > 0 ? 'swipe-left' : 'swipe-right')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typingTarget(e) || document.querySelector('.overlay') || e.ctrlKey || e.metaKey || e.altKey) return
      if (nextKey(e)) go(1)
      else if (prevKey(e)) go(-1)
      else if (flipKey(e)) { e.preventDefault(); setFlipped((f) => !f) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  return (
    <section aria-label={t('Flashcard preview')}>
      <Flashcard
        className={`preview ${anim}`}
        animKey={card.id + anim + i}
        front={card.term}
        back={card.definition}
        frontLabel={t('Term')}
        backLabel={t('Definition')}
        example={card.example}
        flipped={flipped}
        onFlip={() => setFlipped((f) => !f)}
        onSpeak={(side) => (side === 'front' ? speak(card.term, set.termLang) : speak(card.definition, set.defLang))}
      />
      <div className="preview-bar">
        <span className="spacer" />
        <span className="counter">
          <button className="icon-btn outlined" onClick={() => go(-1)} aria-label={t('Previous card')} title={t('Previous (← / A)')}><ChevronLeft size={22} /></button>
          <span>{i + 1} / {order.length}</span>
          <button className="icon-btn outlined" onClick={() => go(1)} aria-label={t('Next card')} title={t('Next (→ / D)')}><ChevronRight size={22} /></button>
        </span>
        <span className="spacer right-tools">
          <button
            className={`icon-btn ${mixed ? 'toggled' : ''}`}
            onClick={() => {
              const next = !mixed
              setMixed(next)
              setOrder(next ? shuffleArr(set.cards.map((c) => c.id)) : set.cards.map((c) => c.id))
              setI(0); setFlipped(false)
            }}
            aria-pressed={mixed}
            aria-label={t('Shuffle')}
            title={t('Shuffle')}
          >
            <Shuffle size={20} />
          </button>
          <button className="icon-btn" onClick={() => navigate(`/set/${set.id}/flashcards`)} aria-label={t('Full screen flashcards')} title={t('Full screen')}><Maximize2 size={20} /></button>
        </span>
      </div>
    </section>
  )
}

/** Begriffsliste mit Stern, Vorlesen und Bearbeiten direkt in der Zeile */
function TermList({ set, onStar, onSaved }: { set: StudySet; onStar(c: Card): void; onSaved(s: StudySet): void }) {
  const { t, lang } = useT()
  const [sort, setSort] = useState<Sort>('original')
  const [onlyStarred, setOnlyStarred] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState({ term: '', definition: '' })

  const sorted = useMemo(() => {
    let cs = onlyStarred ? set.cards.filter((c) => c.starred) : set.cards
    if (sort === 'alpha') cs = [...cs].sort((a, b) => a.term.localeCompare(b.term, lang))
    return cs
  }, [set.cards, sort, onlyStarred, lang])

  const save = async (c: Card) => {
    await window.api.updateCard(set.id, c.id, draft)
    onSaved({ ...set, cards: set.cards.map((x) => (x.id === c.id ? { ...x, ...draft } : x)) })
    setEditing(null)
  }
  const editKeys = (c: Card) => (e: React.KeyboardEvent) => { if (e.key === 'Enter') save(c); if (e.key === 'Escape') setEditing(null) }

  const row = (c: Card) =>
    editing === c.id ? (
      <div key={c.id} className="term-row editing">
        <div className="t"><input className="input" autoFocus value={draft.term} onChange={(e) => setDraft({ ...draft, term: e.target.value })} aria-label={t('Term')} onKeyDown={editKeys(c)} /></div>
        <div className="d"><input className="input" value={draft.definition} onChange={(e) => setDraft({ ...draft, definition: e.target.value })} aria-label={t('Definition')} onKeyDown={editKeys(c)} /></div>
        <div className="acts"><button className="btn btn-primary" onClick={() => save(c)}>{t('Done')}</button></div>
      </div>
    ) : (
      <div key={c.id} className="term-row">
        <div className="t">{c.term}</div>
        <div className="d">{c.definition}{c.example && <div className="ex">{c.example}</div>}</div>
        <div className="acts">
          <span className="level" title={t('Level {n} of 4', { n: c.stats.box })}>{[1, 2, 3, 4].map((n) => <i key={n} className={c.stats.box >= n ? 'on' : ''} />)}</span>
          <button className={`icon-btn ${c.starred ? 'on' : ''}`} onClick={() => onStar(c)} aria-label={c.starred ? t('Remove star') : t('Star')}><Star size={19} /></button>
          <button className="icon-btn" onClick={() => speak(c.term, set.termLang)} aria-label={t('Read aloud')}><Volume2 size={19} /></button>
          <button className="icon-btn" onClick={() => { setEditing(c.id); setDraft({ term: c.term, definition: c.definition }) }} aria-label={t('Edit')}><Pencil size={18} /></button>
        </div>
      </div>
    )

  const groups: [string, Card[]][] =
    sort === 'status'
      ? [
          [t('Still learning'), sorted.filter((c) => c.stats.box > 0 && c.stats.box < 3)],
          [t('Not studied'), sorted.filter((c) => c.stats.box === 0)],
          [t('Known'), sorted.filter((c) => c.stats.box >= 3)]
        ]
      : [['', sorted]]

  return (
    <section style={{ marginTop: 28 }}>
      <div className="section-head">
        <h2>{t('Terms in this set ({n})', { n: set.cards.length })}</h2>
        <div className="row">
          <div className="seg" role="group" aria-label={t('Filter')}>
            <button className={!onlyStarred ? 'on' : ''} onClick={() => setOnlyStarred(false)}>{t('All')}</button>
            <button className={onlyStarred ? 'on' : ''} onClick={() => setOnlyStarred(true)}>{t('Starred ({n})', { n: set.cards.filter((c) => c.starred).length })}</button>
          </div>
          <select className="select" style={{ width: 190 }} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label={t('Sort')}>
            <option value="original">{t('Original order')}</option>
            <option value="alpha">{t('Alphabetical')}</option>
            <option value="status">{t('By progress')}</option>
          </select>
        </div>
      </div>
      {groups.map(([label, cs]) =>
        cs.length ? (
          <div key={label || 'all'}>
            {label && <div className="group-label">{label} ({cs.length})</div>}
            <div className="terms">{cs.map(row)}</div>
          </div>
        ) : null
      )}
      {onlyStarred && !sorted.length && <p className="muted">{t('No starred cards yet. Click the star next to a term.')}</p>}
    </section>
  )
}
