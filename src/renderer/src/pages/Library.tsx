import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Folder, Plus } from 'lucide-react'
import type { SetSummary } from '@shared/types'
import { useSets } from '../lib/app-state'
import { pct } from '../lib/study'
import { useT, type T } from '../lib/settings'

function groupOf(s: SetSummary, t: T, lang: string): string {
  const d = new Date(s.lastStudied || s.updated)
  const days = (Date.now() - d.getTime()) / 86400000
  if (days < 7) return t('This week')
  if (days < 31) return t('This month')
  return d.toLocaleDateString(lang, { month: 'long', year: 'numeric' })
}

export default function Library() {
  const { name } = useParams()
  const folder = name ? decodeURIComponent(name) : null
  const sets = useSets()
  const navigate = useNavigate()
  const { t, tn, lang } = useT()
  const [tab, setTab] = useState<'sets' | 'folders'>('sets')
  const [sort, setSort] = useState<'recent' | 'title'>('recent')
  const [filter, setFilter] = useState('')
  if (!sets) return null

  let list = folder ? sets.filter((s) => s.folder === folder) : sets
  if (filter) list = list.filter((s) => (s.title + ' ' + s.description).toLowerCase().includes(filter.toLowerCase()))
  if (sort === 'title') list = [...list].sort((a, b) => a.title.localeCompare(b.title, lang))
  const folders = [...new Set(sets.map((s) => s.folder).filter(Boolean))].sort((a, b) => a.localeCompare(b, lang))

  const rows: ReactNode[] = []
  let lastGroup = ''
  for (const s of list) {
    const g = sort === 'recent' ? groupOf(s, t, lang) : ''
    if (g && g !== lastGroup) { rows.push(<div key={'g' + g} className="group-label">{g}</div>); lastGroup = g }
    rows.push(
      <Link key={s.id} to={`/set/${s.id}`} className="list-row">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="meta">{tn(s.count, '{n} term', '{n} terms')}{s.folder && !folder ? ` · ${s.folder}` : ''}</div>
          <h3 style={{ marginTop: 2 }}>{s.title}</h3>
        </div>
        <span className="meta">{s.known + s.learning ? t('{p}% known', { p: pct(s.known, s.count) }) : t('Not studied yet')}</span>
      </Link>
    )
  }

  return (
    <div className="page-inner">
      <div className="row" style={{ marginTop: 16 }}>
        {folder && <Folder size={28} className="muted" />}
        <h1 className="spacer">{folder ?? t('Your library')}</h1>
        <button className="btn btn-primary" onClick={() => navigate('/create', { state: folder ? { folder } : undefined })}><Plus size={18} /> {t('Create study set')}</button>
      </div>
      {!folder && (
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'sets'} className={`tab ${tab === 'sets' ? 'on' : ''}`} onClick={() => setTab('sets')}>{t('Study sets')}</button>
          <button role="tab" aria-selected={tab === 'folders'} className={`tab ${tab === 'folders' ? 'on' : ''}`} onClick={() => setTab('folders')}>{t('Folders')}</button>
        </div>
      )}
      {folder && <div style={{ height: 20 }} />}

      {tab === 'sets' || folder ? (
        <>
          <div className="row" style={{ marginBottom: 6 }}>
            <select className="select" style={{ width: 180 }} value={sort} onChange={(e) => setSort(e.target.value as 'recent' | 'title')} aria-label={t('Sort')}>
              <option value="recent">{t('Recent')}</option>
              <option value="title">{t('Title A–Z')}</option>
            </select>
            <span className="spacer" />
            <input className="input" style={{ width: 280 }} placeholder={t('Filter study sets')} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={t('Filter study sets')} />
          </div>
          {rows.length ? rows : (
            <div className="empty" style={{ marginTop: 20 }}>
              <h2>{filter ? t('No matches') : t('No study sets yet')}</h2>
              <p>{filter ? t('Try a different search term.') : t('Create a study set or import vocabulary from Excel.')}</p>
            </div>
          )}
        </>
      ) : folders.length ? (
        folders.map((f) => {
          const n = sets.filter((s) => s.folder === f).length
          return (
            <Link key={f} to={`/folder/${encodeURIComponent(f)}`} className="list-row">
              <span className="folder-token" aria-hidden="true">{f.slice(0, 2)}</span>
              <h3 className="spacer">{f}</h3>
              <span className="meta">{tn(n, '{n} set', '{n} sets')}</span>
            </Link>
          )
        })
      ) : (
        <div className="empty">
          <h2>{t('No folders yet')}</h2>
          <p>{t('Give a study set a folder while editing it, e.g. “English” or “Latin”. It then shows up here and in the sidebar.')}</p>
        </div>
      )}
    </div>
  )
}
