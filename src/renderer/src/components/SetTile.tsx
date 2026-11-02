import { Link } from 'react-router-dom'
import { Folder } from 'lucide-react'
import type { SetSummary } from '@shared/types'
import { pct } from '../lib/study'
import { useT } from '../lib/settings'

export default function SetTile({ set }: { set: SetSummary }) {
  const { t, tn } = useT()
  const studied = set.known + set.learning > 0
  return (
    <Link to={`/set/${set.id}`} className="set-tile">
      <h3>{set.title}</h3>
      <span className="pill">{tn(set.count, '{n} term', '{n} terms')}</span>
      {set.folder && <span className="small muted row" style={{ gap: 6 }}><Folder size={14} /> {set.folder}</span>}
      <div className="tile-foot">
        {studied ? (
          <>
            <div className="mini-bar" aria-hidden="true">
              <i className="k" style={{ width: `${pct(set.known, set.count)}%` }} />
              <i className="l" style={{ width: `${pct(set.learning, set.count)}%` }} />
            </div>
            <span>{t('{p}% known', { p: pct(set.known, set.count) })}</span>
          </>
        ) : (
          <span>{t('Not studied yet')}</span>
        )}
      </div>
    </Link>
  )
}
