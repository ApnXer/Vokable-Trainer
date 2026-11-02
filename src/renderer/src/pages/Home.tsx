import { Link, useNavigate } from 'react-router-dom'
import { Copy, Plus, Upload } from 'lucide-react'
import { useSets } from '../lib/app-state'
import { useT } from '../lib/settings'
import SetTile from '../components/SetTile'

export default function Home() {
  const sets = useSets()
  const navigate = useNavigate()
  const { t, tn } = useT()
  if (!sets) return null
  const recent = sets.filter((s) => s.lastStudied).slice(0, 6)

  if (!sets.length) {
    return (
      <div className="page-inner">
        <div className="empty" style={{ marginTop: 40 }}>
          <h2>{t('Welcome to Vocab Trainer')}</h2>
          <p>{t('Create your first study set. The fastest way: copy your vocabulary from Excel and paste it in.')}</p>
          <div className="row">
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/create')}><Plus size={18} /> {t('Create study set')}</button>
            <button className="btn btn-lg" onClick={() => navigate('/create', { state: { openImport: true } })}><Upload size={18} /> {t('Import from Excel')}</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-inner">
      {recent.length > 0 && (
        <section className="section" style={{ marginTop: 16 }}>
          <div className="section-head"><h2>{t('Recently studied')}</h2></div>
          <div className="recent-grid">
            {recent.map((s) => (
              <Link key={s.id} to={`/set/${s.id}`} className="recent">
                <span className="recent-icon"><Copy size={20} /></span>
                <span style={{ minWidth: 0 }}>
                  <b>{s.title}</b>
                  <span>{tn(s.count, '{n} term', '{n} terms')} · {t('{k} known', { k: s.known })}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
      <section className="section">
        <div className="section-head">
          <h2>{t('Your study sets')}</h2>
          <Link to="/library">{t('View all')}</Link>
        </div>
        <div className="set-grid">
          {sets.slice(0, 9).map((s) => <SetTile key={s.id} set={s} />)}
        </div>
      </section>
    </div>
  )
}
