import { useEffect, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { StudySet } from '@shared/types'
import { useSet } from '../lib/app-state'
import { Dialog } from '../components/ui'
import type { StudyOpts } from '../lib/study'
import { useT } from '../lib/settings'

/** Lädt das Set einmalig (kein Neuladen mitten im Lernen) und liefert optionale feste Karten-IDs aus dem Router-State. */
export function useStudySet(): { set: StudySet | null | undefined; ids: string[] | null } {
  const { id } = useParams()
  const [set] = useSet(id, false)
  const location = useLocation()
  const ids = ((location.state as { ids?: string[] } | null)?.ids ?? null) as string[] | null
  return { set, ids }
}

/** Esc schließt den Lernmodus */
export function useEscToClose(setId: string | undefined, enabled = true): void {
  const navigate = useNavigate()
  useEffect(() => {
    if (!enabled || !setId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.overlay')) navigate(`/set/${setId}`)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [setId, enabled, navigate])
}

export function NotFound() {
  const navigate = useNavigate()
  const { t } = useT()
  return (
    <div className="study"><div className="center-card"><h1>{t('Study set not found')}</h1><button className="btn btn-primary" onClick={() => navigate('/')}>{t('Back to home')}</button></div></div>
  )
}

/** Gemeinsame Optionen: Richtung, nur markierte Karten, mischen */
export function DirectionOptions({ o, set, onChange }: { o: StudyOpts; set: StudySet; onChange(o: StudyOpts): void }) {
  const { t } = useT()
  const starred = set.cards.filter((c) => c.starred).length
  return (
    <>
      <div className="opt-group">
        <h3>{t('Answer with')}</h3>
        <div className="seg" role="group" aria-label={t('Answer with')}>
          <button className={o.dir === 'td' ? 'on' : ''} onClick={() => onChange({ ...o, dir: 'td' })}>{t('Definition')}</button>
          <button className={o.dir === 'dt' ? 'on' : ''} onClick={() => onChange({ ...o, dir: 'dt' })}>{t('Term')}</button>
          <button className={o.dir === 'mix' ? 'on' : ''} onClick={() => onChange({ ...o, dir: 'mix' })}>{t('Both')}</button>
        </div>
      </div>
      <div className="opt-group">
        <label className="opt-line">
          <span>{starred ? t('Study starred terms only ({n})', { n: starred }) : t('Study starred terms only (none starred yet)')}</span>
          <span className="switch"><input type="checkbox" checked={o.starred} disabled={!starred} onChange={(e) => onChange({ ...o, starred: e.target.checked })} /></span>
        </label>
        <label className="opt-line">
          <span>{t('Shuffle terms')}</span>
          <span className="switch"><input type="checkbox" checked={o.shuffle} onChange={(e) => onChange({ ...o, shuffle: e.target.checked })} /></span>
        </label>
      </div>
    </>
  )
}

export function OptionsDialog({ children, onClose, onRestart }: { children: ReactNode; onClose(): void; onRestart?(): void }) {
  const { t } = useT()
  return (
    <Dialog
      title={t('Options')}
      onClose={onClose}
      footer={
        <>
          {onRestart && <button className="btn btn-ghost" onClick={onRestart}>{t('Restart')}</button>}
          <span className="spacer" />
          <button className="btn btn-primary" onClick={onClose}>{t('Done')}</button>
        </>
      }
    >
      {children}
    </Dialog>
  )
}
