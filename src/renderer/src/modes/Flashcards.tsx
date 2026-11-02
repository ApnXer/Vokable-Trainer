import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, Undo2, Volume2, X } from 'lucide-react'
import type { Card, ProgressResult } from '@shared/types'
import StudyHeader from '../components/StudyHeader'
import Flashcard from '../components/Flashcard'
import { Ring } from '../components/ui'
import { buildDeck, loadOpts, pct, qa, saveOpts, speak, type QA, type StudyOpts } from '../lib/study'
import { flipKey, nextKey, prevKey, typingTarget } from '../lib/keys'
import { useT } from '../lib/settings'
import { DirectionOptions, NotFound, OptionsDialog, useEscToClose, useStudySet } from './common'

interface Entry { card: Card; p: QA }

export default function Flashcards() {
  const { set, ids } = useStudySet()
  const navigate = useNavigate()
  const { t, tn } = useT()
  const [o, setO] = useState<StudyOpts>(loadOpts)
  const [deckIds, setDeckIds] = useState<string[] | null>(ids)
  const [round, setRound] = useState(0)
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [results, setResults] = useState<ProgressResult[]>([])
  const [anim, setAnim] = useState('')
  const [bump, setBump] = useState<'k' | 'l' | null>(null)
  const [showOpts, setShowOpts] = useState(false)
  const [, forceRender] = useState(0)
  useEscToClose(set?.id, !showOpts)

  const deck: Entry[] = useMemo(() => {
    if (!set) return []
    return buildDeck(set, o, deckIds).map((card) => ({ card, p: qa(card, set, o.dir) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set, deckIds, round, o.dir, o.starred, o.shuffle])

  const done = i >= deck.length && deck.length > 0
  const cur = deck[Math.min(i, deck.length - 1)]
  const knownN = results.filter((r) => r.correct).length
  const learnN = results.length - knownN

  const move = useCallback((d: number) => {
    setFlipped(false)
    setAnim(d > 0 ? 'swipe-left' : 'swipe-right')
    setI((x) => Math.max(0, Math.min(deck.length - (o.track ? 0 : 1), x + d)))
  }, [deck.length, o.track])

  const judge = useCallback((ok: boolean) => {
    if (!cur || done) return
    setResults((r) => [...r.slice(0, i), { cardId: cur.card.id, correct: ok }])
    setBump(ok ? 'k' : 'l')
    move(1)
  }, [cur, done, i, move])

  const undo = () => {
    if (!i) return
    setResults((r) => r.slice(0, i - 1))
    move(-1)
  }

  // Ergebnisse am Ende speichern
  useEffect(() => {
    if (done && o.track && results.length && set) window.api.recordProgress(set.id, results)
  }, [done]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showOpts || done || !cur || e.repeat || typingTarget(e)) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { undo(); return }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (flipKey(e)) { e.preventDefault(); setFlipped((f) => !f) }
      else if (nextKey(e)) o.track ? judge(true) : move(1)
      else if (prevKey(e)) o.track ? judge(false) : move(-1)
      else if (e.key.toLowerCase() === 'r') speak(flipped ? cur.p.a : cur.p.q, flipped ? cur.p.aLang : cur.p.qLang)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  if (set === undefined) return null
  if (set === null) return <NotFound />

  const restart = (newIds: string[] | null) => {
    setDeckIds(newIds); setRound((r) => r + 1); setI(0); setResults([]); setFlipped(false)
  }
  const updateOpts = (n: StudyOpts) => { setO(n); saveOpts(n); restart(deckIds) }
  const toggleStar = async () => {
    cur.card.starred = !cur.card.starred
    forceRender((n) => n + 1)
    await window.api.updateCard(set.id, cur.card.id, { starred: cur.card.starred })
  }

  const header = (
    <StudyHeader
      setId={set.id}
      mode="flashcards"
      title={set.title}
      status={deck.length ? `${Math.min(i + 1, deck.length)} / ${deck.length}` : ''}
      progress={deck.length ? i / deck.length : 0}
      onSettings={() => setShowOpts(true)}
    />
  )

  if (done) {
    const unknown = results.filter((r) => !r.correct).map((r) => r.cardId)
    return (
      <div className="study">
        {header}
        <div className="study-body">
          <div className="study-inner">
            {o.track ? (
              <>
                <div className="result-head">
                  <Ring value={pct(knownN, results.length)} />
                  <div>
                    <h1>{unknown.length ? t('Nice work! Keep going.') : t('You know every term!')}</h1>
                    <p>{unknown.length ? tn(unknown.length, 'Practice the {n} term you are still learning until it sticks.', 'Practice the {n} terms you are still learning until they stick.') : t('Continue with Learn or a test to lock it in.')}</p>
                    <div className="score-lines"><span className="k">{t('Know: {n}', { n: knownN })}</span><span className="l">{t('Still learning: {n}', { n: learnN })}</span></div>
                  </div>
                </div>
                <div className="row" style={{ marginTop: 24 }}>
                  {unknown.length > 0 && (
                    <button className="btn btn-primary btn-lg" onClick={() => restart(unknown)}>{tn(unknown.length, 'Keep practicing {n} term', 'Keep practicing {n} terms')}</button>
                  )}
                  <button className="btn btn-lg" onClick={() => restart(null)}>{t('Restart flashcards')}</button>
                  <button className="btn btn-lg" onClick={() => navigate(`/set/${set.id}/learn`)}>{t('Go to Learn')}</button>
                </div>
              </>
            ) : (
              <div className="center-card">
                <h1>{t('End of the deck')}</h1>
                <p>{tn(deck.length, 'You went through {n} card.', 'You went through all {n} cards.')}</p>
                <button className="btn btn-primary btn-lg" onClick={() => restart(null)}>{t('Start over')}</button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!cur) {
    return (
      <div className="study">{header}<div className="center-card"><h1>{t('No cards')}</h1><p>{t('This set has no complete cards yet.')}</p></div></div>
    )
  }

  const front = cur.p.dir === 'td' ? t('Term') : t('Definition')
  const back = cur.p.dir === 'td' ? t('Definition') : t('Term')

  return (
    <div className="study">
      {header}
      <div className="study-body">
        <div className="study-inner">
          {o.track && (
            <div className="fc-counts">
              <span className="count-pill l"><b key={'l' + learnN} className={bump === 'l' ? 'bump' : ''}>{learnN}</b> {t('Still learning')}</span>
              <span className="count-pill k">{t('Know')} <b key={'k' + knownN} className={bump === 'k' ? 'bump' : ''}>{knownN}</b></span>
            </div>
          )}
          <Flashcard
            className={`fc-stage big ${anim}`}
            animKey={cur.card.id + anim + i}
            front={cur.p.q}
            back={cur.p.a}
            frontLabel={front}
            backLabel={back}
            example={cur.card.example}
            flipped={flipped}
            onFlip={() => setFlipped((f) => !f)}
            onSpeak={(side) => (side === 'front' ? speak(cur.p.q, cur.p.qLang) : speak(cur.p.a, cur.p.aLang))}
            starred={cur.card.starred}
            onStar={toggleStar}
          />
          <div className="fc-controls">
            <label className="switch">
              <input type="checkbox" checked={o.track} onChange={(e) => { const n = { ...o, track: e.target.checked }; setO(n); saveOpts(n) }} />
              {t('Track progress')}
            </label>
            <div className="mid">
              {o.track ? (
                <>
                  <button className="judge no" onClick={() => judge(false)} aria-label={t('Still learning')} title={t('Still learning (← / A)')}><X size={24} /></button>
                  <span className="counter">{i + 1} / {deck.length}</span>
                  <button className="judge yes" onClick={() => judge(true)} aria-label={t('Know')} title={t('Know (→ / D)')}><Check size={24} /></button>
                </>
              ) : (
                <>
                  <button className="icon-btn outlined" onClick={() => move(-1)} disabled={!i} aria-label={t('Previous card')} title={t('Previous (← / A)')}><ChevronLeft size={22} /></button>
                  <span className="counter">{i + 1} / {deck.length}</span>
                  <button className="icon-btn outlined" onClick={() => move(1)} aria-label={t('Next card')} title={t('Next (→ / D)')}><ChevronRight size={22} /></button>
                </>
              )}
            </div>
            <div className="rightside">
              {o.track && <button className="icon-btn" onClick={undo} disabled={!i} aria-label={t('Undo')} title={t('Undo (Ctrl+Z)')}><Undo2 size={20} /></button>}
              <button className="icon-btn" onClick={() => speak(flipped ? cur.p.a : cur.p.q, flipped ? cur.p.aLang : cur.p.qLang)} aria-label={t('Read aloud')} title={t('Read aloud (R)')}><Volume2 size={20} /></button>
            </div>
          </div>
          <p className="hint">
            <kbd>{t('Space')}</kbd> / <kbd>W</kbd> <kbd>S</kbd> / <kbd>↑</kbd> <kbd>↓</kbd> {t('flip')}
            {' · '}<kbd>A</kbd> / <kbd>←</kbd> {o.track ? t('still learning') : t('previous')}
            {' · '}<kbd>D</kbd> / <kbd>→</kbd> {o.track ? t('know') : t('next')}
            {' · '}<kbd>R</kbd> {t('read aloud')}
          </p>
        </div>
      </div>
      {showOpts && (
        <OptionsDialog onClose={() => setShowOpts(false)} onRestart={() => { restart(null); setShowOpts(false) }}>
          <DirectionOptions o={o} set={set} onChange={updateOpts} />
        </OptionsDialog>
      )}
    </div>
  )
}
