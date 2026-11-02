import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { Card, SetSummary } from '@shared/types'
import { useAppState } from '../lib/app-state'
import { useT } from '../lib/settings'
import SetTile from '../components/SetTile'

interface Hit { setId: string; setTitle: string; card: Card }

export default function SearchPage() {
  const [params] = useSearchParams()
  const q = (params.get('q') ?? '').trim()
  const { version } = useAppState()
  const { t } = useT()
  const [result, setResult] = useState<{ sets: SetSummary[]; hits: Hit[] } | null>(null)

  useEffect(() => {
    let live = true
    ;(async () => {
      const ql = q.toLowerCase()
      const all = await window.api.listSets()
      const sets = all.filter((s) => (s.title + ' ' + s.description + ' ' + s.folder).toLowerCase().includes(ql))
      const hits: Hit[] = []
      for (const s of all) {
        const full = await window.api.getSet(s.id)
        for (const c of full?.cards ?? []) {
          if ([c.term, c.definition, c.example ?? ''].some((x) => x.toLowerCase().includes(ql))) hits.push({ setId: s.id, setTitle: s.title, card: c })
        }
      }
      if (live) setResult({ sets, hits: hits.slice(0, 200) })
    })()
    return () => { live = false }
  }, [q, version])

  return (
    <div className="page-inner">
      <h1 style={{ marginTop: 16 }}>{t('Results for “{q}”', { q })}</h1>
      {result && (
        <>
          {result.sets.length > 0 && (
            <section className="section">
              <div className="section-head"><h2>{t('Study sets')}</h2></div>
              <div className="set-grid">{result.sets.map((s) => <SetTile key={s.id} set={s} />)}</div>
            </section>
          )}
          <section className="section">
            <div className="section-head"><h2>{t('Terms ({n})', { n: result.hits.length })}</h2></div>
            {result.hits.length ? (
              <div className="terms">
                {result.hits.map((h) => (
                  <div key={h.setId + h.card.id} className="term-row">
                    <div className="t">{h.card.term}</div>
                    <div className="d">{h.card.definition}</div>
                    <div className="acts"><Link to={`/set/${h.setId}`} className="small" style={{ padding: '10px 8px' }}>{h.setTitle}</Link></div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">{t('No terms found.')}</p>
            )}
          </section>
        </>
      )}
    </div>
  )
}
