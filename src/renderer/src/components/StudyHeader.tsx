import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ClipboardCheck, Copy, House, Repeat2, Settings, Shapes, X } from 'lucide-react'
import { Menu } from './ui'
import { useT } from '../lib/settings'

export const MODES = [
  { key: 'flashcards', label: 'Flashcards', Icon: Copy },
  { key: 'learn', label: 'Learn', Icon: Repeat2 },
  { key: 'test', label: 'Test', Icon: ClipboardCheck },
  { key: 'match', label: 'Match', Icon: Shapes }
] as const
export type ModeKey = (typeof MODES)[number]['key']

interface Props {
  setId: string
  mode: ModeKey
  title: string
  status: ReactNode
  progress?: number
  onSettings?(): void
}

/** Kopfzeile aller Lernmodi: Modus-Wechsel links, Titel/Zähler mittig, Optionen und Schließen rechts */
export default function StudyHeader({ setId, mode, title, status, progress, onSettings }: Props) {
  const navigate = useNavigate()
  const { t } = useT()
  const cur = MODES.find((m) => m.key === mode)!
  return (
    <>
      <header className="study-head">
        <div>
          <Menu
            align="left"
            button={(toggle) => (
              <button className="mode-switch" onClick={toggle} aria-haspopup="menu">
                <cur.Icon size={20} /> {t(cur.label)} <ChevronDown size={16} />
              </button>
            )}
          >
            {(close) => (
              <>
                {MODES.map(({ key, label, Icon }) => (
                  <button key={key} className={key === mode ? 'on' : ''} onClick={() => { close(); navigate(`/set/${setId}/${key}`, { replace: true }) }}>
                    <Icon size={18} /> {t(label)}
                  </button>
                ))}
                <hr />
                <button onClick={() => navigate('/')}><House size={18} /> {t('Home')}</button>
              </>
            )}
          </Menu>
        </div>
        <div className="center">
          <span>{status}</span>
          <b>{title}</b>
        </div>
        <div className="right">
          {onSettings && (
            <button className="icon-btn" onClick={onSettings} aria-label={t('Options')} title={t('Options')}><Settings size={20} /></button>
          )}
          <button className="icon-btn" onClick={() => navigate(`/set/${setId}`)} aria-label={t('Close')} title={t('Close (Esc)')}><X size={22} /></button>
        </div>
      </header>
      {progress !== undefined && (
        <div className="study-progress"><i style={{ transform: `scaleX(${Math.max(0, Math.min(1, progress))})` }} /></div>
      )}
    </>
  )
}
