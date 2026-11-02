import { useEffect, useRef, useState } from 'react'
import type { StudySet } from '@shared/types'
import StudyHeader from '../components/StudyHeader'
import { buildDeck, loadOpts, shuffle, usable } from '../lib/study'
import { useT } from '../lib/settings'
import { NotFound, useEscToClose, useStudySet } from './common'

interface Tile { id: string; text: string; side: 'term' | 'def' }
const PAIRS = 6
const PENALTY = 1

export default function Match() {
  const { set } = useStudySet()
  if (set === undefined) return null
  if (set === null) return <NotFound />
  return <MatchGame set={set} />
}

function bestKey(id: string) { return `vt_match_best_${id}` }

function MatchGame({ set }: { set: StudySet }) {
  useEscToClose(set.id)
  const { t, tn, lang } = useT()
  const [phase, setPhase] = useState<'ready' | 'play' | 'done'>('ready')
  const [tiles, setTiles] = useState<Tile[]>([])
  const [sel, setSel] = useState<number | null>(null)
  const [gone, setGone] = useState<Set<number>>(new Set())
  const [ok, setOk] = useState<Set<number>>(new Set())
  const [bad, setBad] = useState<number[]>([])
  const [mistakes, setMistakes] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const start = useRef(0)
  const [best, setBest] = useState<number | null>(() => { try { return Number(localStorage.getItem(bestKey(set.id))) || null } catch { return null } })
  const [isRecord, setIsRecord] = useState(false)

  const enough = usable(set).length >= 2

  const begin = () => {
    const cards = buildDeck(set, { ...loadOpts(), shuffle: true }).slice(0, PAIRS)
    setTiles(shuffle(cards.flatMap((c) => [{ id: c.id, text: c.term, side: 'term' as const }, { id: c.id, text: c.definition, side: 'def' as const }])))
    setSel(null); setGone(new Set()); setOk(new Set()); setBad([]); setMistakes(0); setElapsed(0); setIsRecord(false)
    start.current = performance.now()
    setPhase('play')
  }

  useEffect(() => {
    if (phase !== 'play') return
    const id = window.setInterval(() => setElapsed((performance.now() - start.current) / 1000), 100)
    return () => window.clearInterval(id)
  }, [phase])

  const total = elapsed + mistakes * PENALTY

  const click = (k: number) => {
    if (gone.has(k) || ok.has(k)) return
    if (sel === null) { setSel(k); return }
    if (sel === k) { setSel(null); return }
    const a = tiles[sel]
    const b = tiles[k]
    const first = sel
    setSel(null)
    if (a.id === b.id && a.side !== b.side) {
      const nextOk = new Set(ok).add(first).add(k)
      setOk(nextOk)
      window.setTimeout(() => setGone((g) => new Set(g).add(first).add(k)), 320)
      if (nextOk.size === tiles.length) {
        const final = (performance.now() - start.current) / 1000 + mistakes * PENALTY
        setElapsed(final - mistakes * PENALTY)
        const record = !best || final < best
        if (record) { setBest(final); try { localStorage.setItem(bestKey(set.id), String(final)) } catch { /* ignorieren */ } }
        setIsRecord(record)
        window.api.recordProgress(set.id, [...new Set(tiles.map((x) => x.id))].map((cardId) => ({ cardId, correct: true })))
        window.setTimeout(() => setPhase('done'), 450)
      }
    } else {
      setMistakes((m) => m + 1)
      setBad([first, k])
      window.setTimeout(() => setBad([]), 400)
    }
  }

  const fmt = (s: number) => s.toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const status = phase === 'play' ? <span className="timer">{fmt(total)} s</span> : best ? t('Best time {s} s', { s: fmt(best) }) : t('Match')

  return (
    <div className="study">
      <StudyHeader setId={set.id} mode="match" title={set.title} status={status} />
      <div className="study-body">
        <div className="study-inner" style={{ maxWidth: 1040 }}>
          {phase === 'ready' && (
            <div className="center-card">
              <h1>{t('Ready to play?')}</h1>
              <p>{enough ? t('Match all the terms with their definitions as fast as you can. Every wrong pair adds {n} second.', { n: PENALTY }) : t('You need at least two complete cards to play Match.')}</p>
              <button className="btn btn-primary btn-lg" onClick={begin} disabled={!enough} autoFocus>{t('Start game')}</button>
            </div>
          )}
          {phase === 'play' && (
            <div className="match-grid">
              {tiles.map((tile, k) => (
                <button
                  key={k}
                  className={`tile ${sel === k ? 'sel' : ''} ${ok.has(k) ? 'ok' : ''} ${gone.has(k) ? 'gone' : ''} ${bad.includes(k) ? 'bad' : ''}`}
                  onClick={() => click(k)}
                  aria-pressed={sel === k}
                  disabled={gone.has(k)}
                >
                  {tile.text}
                </button>
              ))}
            </div>
          )}
          {phase === 'done' && (
            <div className="center-card">
              <h1>{isRecord ? t('New best time!') : t('Nice work!')}</h1>
              <div className="big-num">{fmt(total)} s</div>
              <p>
                {mistakes ? tn(mistakes, '{n} wrong pair (+{p} s)', '{n} wrong pairs (+{p} s)', { p: mistakes * PENALTY }) : t('Without a single mistake.')}
                {best && !isRecord ? ' ' + t('Your best time: {s} s.', { s: fmt(best) }) : ''}
              </p>
              <button className="btn btn-primary btn-lg" onClick={begin} autoFocus>{t('Play again')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
