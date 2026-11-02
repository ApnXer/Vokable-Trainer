import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom'
import { House, Library, Plus, Search, Settings as SettingsIcon, Upload } from 'lucide-react'
import { Logo, Menu } from './ui'
import SettingsDialog from './SettingsDialog'
import { useSets } from '../lib/app-state'
import { useT } from '../lib/settings'

export default function Layout() {
  const sets = useSets()
  const navigate = useNavigate()
  const { t } = useT()
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [showSettings, setShowSettings] = useState(false)
  const folders = [...new Set((sets ?? []).map((s) => s.folder).filter(Boolean))].sort((a, b) => a.localeCompare(b))

  return (
    <div className="shell">
      <aside className="sidebar" aria-label={t('Navigation')}>
        <Link to="/" className="brand"><Logo /><span>{t('Vocab Trainer')}</span></Link>
        <NavLink to="/" end title={t('Home')} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <House size={20} /><span>{t('Home')}</span>
        </NavLink>
        <NavLink to="/library" title={t('Your library')} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Library size={20} /><span>{t('Your library')}</span>
          {sets && <span className="count">{sets.length}</span>}
        </NavLink>
        <div className="nav-sep" />
        <div className="nav-label">{t('Your folders')}</div>
        {folders.map((f) => (
          <NavLink key={f} title={f} to={`/folder/${encodeURIComponent(f)}`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="folder-token" aria-hidden="true">{f.slice(0, 2)}</span><span>{f}</span>
            <span className="count">{sets!.filter((s) => s.folder === f).length}</span>
          </NavLink>
        ))}
        {!folders.length && <div className="nav-label nav-hint">{t('Add a folder when you edit a set.')}</div>}
        <div className="sidebar-foot">
          <button className="nav-item" title={t('Import from Excel')} onClick={() => navigate('/create', { state: { openImport: true } })}>
            <Upload size={20} /><span>{t('Import from Excel')}</span>
          </button>
          <button className="nav-item" title={t('Settings')} onClick={() => setShowSettings(true)}>
            <SettingsIcon size={20} /><span>{t('Settings')}</span>
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <form
            className="search"
            role="search"
            onSubmit={(e) => { e.preventDefault(); if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`) }}
          >
            <Search size={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search sets and terms')} aria-label={t('Search')} />
          </form>
          <Menu
            button={(toggle) => (
              <button className="icon-btn round-primary" onClick={toggle} aria-label={t('Create')} title={t('Create')}><Plus size={22} /></button>
            )}
          >
            {(close) => (
              <>
                <button onClick={() => { close(); navigate('/create') }}><Plus size={18} /> {t('Create study set')}</button>
                <button onClick={() => { close(); navigate('/create', { state: { openImport: true } }) }}><Upload size={18} /> {t('Import from Excel or text')}</button>
              </>
            )}
          </Menu>
        </header>
        <main className="page" id="page">
          <Outlet />
        </main>
      </div>
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </div>
  )
}
