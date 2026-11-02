import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Volume2, X } from 'lucide-react'
import type { Card, ProgressResult, StudySet } from '@shared/types'
import { checkAnswer, type AnswerResult } from '@shared/text'
import StudyHeader from '../components/StudyHeader'
import { Ring, StatusBar } from '../components/ui'
import { buildDeck, distractors, loadOpts, pct, qa, saveOpts, shuffle, speak, usable, type QA, type StudyOpts } from '../lib/study'
import { useT } from '../lib/settings'
import { DirectionOptions, NotFound, OptionsDialog, useEscToClose, useStudySet } from './common'

type QType = 'mc' | 'tf' | 'write'
interface Item { card: Card; step: number; wrongs: number; done: boolean }
interface Question { item: Item; type: QType; p: QA; options: string[]; shown: string; truth: boolean }
interface Feedback { ok: boolean; kind: AnswerResult | null; typed: string; chosen: number | null; prevStep: number; skipped: boolean }
type Phase = 'question' | 'feedback' | 'checkpoint' | 'done'

const ROUND = 7
const PRAISE = ['Great job!', 'Correct!', 'Awesome!', 'Spot on!', 'Keep it up!']

function stepsFor(o: StudyOpts, set: StudySet): QType[] {
  const choiceOk = usable(set).length >= 2
  let s = (['mc', 'tf', 'write'] as QType[]).filter((t) => o.learn[t] && (choiceOk || t === 'write'))
  if (!s.length) s = ['write']
  return s.length === 1 ? [s[0], s[0]] : s
}

export default function Learn() {
  const { set, ids } = useStudySet()
  if (set === undefined) return null
  if (set === null) return <NotFound />
  return <LearnSession set={set} ids={ids} />
}

function LearnSession({ set, ids }: { set: StudySet; ids: string[] | null }) {
  const navigate = useNavigate()
  const { t, tn } = useT()
  const [o, setO] = useState<StudyOpts>(loadOpts)
  const [session, setSession] = useState(0)
  const [showOpts, setShowOpts] = useState(false)
  useEscToClose(set.id, !showOpts)

  const steps = useRef<QType[]>(stepsFor(o, set))
  const items = useRef<Item[]>([])
  const last = useRef<Item | null>(null)
  const results = useRef<ProgressResult[]>([])
  const flushed = useRef(0)
  const roundItems = useRef<Item[]>([])
  const [q, setQ] = useState<Question | null>(null)
  const [phase, setPhase] = useState<Phase>('question')
  const [fb, setFb] = useState<Feedback | null>(null)
  const [typed, setTyped] = useState('')
  const timer = useRef<number>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)

  const flush = useCallback(() => {
    const part = results.current.slice(flushed.current)
    if (part.length) { flushed.current = results.current.length; window.api.recordProgress(set.id, part) }
  }, [set.id])

  const ask = useCallback(() => {
    const active = items.current.filter((it) => !it.done).slice(0, ROUND)
    if (!active.length) { setPhase('done'); flush(); return }
    const pool = active.length > 1 ? active.filter((it) => it !== last.current) : active
    const item = pool[Math.floor(Math.random() * pool.length)]
    last.current = item
    const type = steps.current[Math.min(item.step, steps.current.length - 1)]
    const p = qa(item.card, set, o.dir)
    const wrong = distractors(set, item.card, p.dir, 3, p.a)
    const truth = Math.random() < 0.5 || !wrong.length
    setQ({ item, type, p, options: shuffle([p.a, ...wrong]), shown: truth ? p.a : wrong[0], truth })
    setFb(null)
    setTyped('')
    setPhase('question')
  }, [set, o.dir, flush])

  // Neue Sitzung (Start, Optionen geändert, „Nochmal“)
  useEffect(() => {
    steps.current = stepsFor(o, set)
    items.current = buildDeck(set, o, ids).map((card) => ({ card, step: 0, wrongs: 0, done: false }))
    results.current = []; flushed.current = 0; roundItems.current = []; last.current = null
    ask()
    return () => { window.clearTimeout(timer.current); flush() }
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (phase === 'question' && q?.type === 'write') inputRef.current?.focus() }, [phase, q])

  const next = useCallback(() => {
    window.clearTimeout(timer.current)
    if (items.current.every((it) => it.done)) { setPhase('done'); flush(); return }
    if (roundItems.current.length >= ROUND) { setPhase('checkpoint'); flush(); return }
    ask()
  }, [ask, flush])

  const resolve = (ok: boolean, extra: Partial<Feedback>) => {
    if (!q || phase !== 'question') return
    const it = q.item
    const prevStep = it.step
    results.current.push({ cardId: it.card.id, correct: ok })
    if (!roundItems.current.includes(it)) roundItems.current.push(it)
    if (ok) { it.step++; if (it.step >= steps.current.length) it.done = true }
    else { it.step = Math.max(0, it.step - 1); it.wrongs++ }
    setFb({ ok, kind: null, typed: '', chosen: null, prevStep, skipped: false, ...extra })
    setPhase('feedback')
    if (ok && extra.kind !== 'typo') timer.current = window.setTimeout(next, 1100)
    else if (!ok) speak(q.p.a, q.p.aLang)
  }

  const override = () => {
    if (!q || !fb) return
    const it = q.item
    results.current[results.current.length - 1].correct = true
    it.wrongs--
    it.step = fb.prevStep + 1
    if (it.step >= steps.current.length) it.done = true
    next()
  }

  const choose = (idx: number) => { if (q) resolve(q.options[idx] === q.p.a, { chosen: idx }) }
  const chooseTf = (v: boolean) => { if (q) resolve(v === q.truth, { chosen: v ? 1 : 0 }) }
  const submitWrite = (skip = false) => {
    if (!q) return
    const kind = skip ? 'wrong' : checkAnswer(typed, q.p.a)
    resolve(kind !== 'wrong', { kind, typed: skip ? '' : typed, skipped: skip })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showOpts || e.repeat) return
      if (phase === 'feedback' || phase === 'checkpoint') {
        if ((e.target as HTMLElement).tagName === 'BUTTON') return // der fokussierte Button löst selbst aus
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next() }
        return
      }
      if (phase !== 'question' || !q) return
      if (q.type === 'mc') { const n = Number(e.key) - 1; if (n >= 0 && n < q.options.length) choose(n) }
      if (q.type === 'tf') { if (e.key === '1') chooseTf(true); if (e.key === '2') chooseTf(false) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const total = items.current.length
  const mastered = items.current.filter((it) => it.done).length
  const inProgress = items.current.filter((it) => !it.done && (it.step > 0 || it.wrongs > 0)).length
  const progress = items.current.reduce((s, it) => s + (it.done ? steps.current.length : it.step), 0) / Math.max(1, total * steps.current.length)
  const updateOpts = (n: StudyOpts) => { setO(n); saveOpts(n) }

  const header = (
    <StudyHeader setId={set.id} mode="learn" title={set.title} status={t('{m} / {n} mastered', { m: mastered, n: total })} progress={progress} onSettings={() => setShowOpts(true)} />
  )
  const track = (
    <div className="learn-track">
      <StatusBar known={mastered} learning={inProgress} total={total} />
      <div className="legend">
        <span className="lk">{t('{n} mastered', { n: mastered })}</span>
        <span className="ll">{t('{n} in progress', { n: inProgress })}</span>
        <span>{t('{n} not seen yet', { n: total - mastered - inProgress })}</span>
      </div>
    </div>
  )
  const opts = showOpts && (
    <OptionsDialog onClose={() => { setShowOpts(false); setSession((s) => s + 1) }}>
      <div className="opt-group">
        <h3>{t('Question types')}</h3>
        {([['mc', 'Multiple choice'], ['tf', 'True / False'], ['write', 'Written']] as const).map(([k, l]) => (
          <label key={k} className="opt-line">
            <span>{t(l)}</span>
            <span className="switch"><input type="checkbox" checked={o.learn[k]} onChange={(e) => updateOpts({ ...o, learn: { ...o.learn, [k]: e.target.checked } })} /></span>
          </label>
        ))}
        <p className="muted small" style={{ margin: '6px 0 0' }}>{t('Each term is asked in every selected question type in turn. Only then does it count as mastered.')}</p>
      </div>
      <DirectionOptions o={o} set={set} onChange={updateOpts} />
    </OptionsDialog>
  )

  if (!total) {
    return <div className="study">{header}<div className="center-card"><h1>{t('No cards')}</h1><p>{t('Add terms with a definition first.')}</p></div>{opts}</div>
  }

  if (phase === 'done') {
    const right = results.current.filter((r) => r.correct).length
    const tough = items.current.filter((it) => it.wrongs > 0).sort((a, b) => b.wrongs - a.wrongs).slice(0, 8)
    return (
      <div className="study">
        {header}
        <div className="study-body"><div className="study-inner">
          <div className="result-head">
            <Ring value={pct(right, results.current.length)} />
            <div>
              <h1>{tn(total, 'You mastered {n} term!', 'You mastered all {n} terms!')}</h1>
              <p>{t('{r} of {n} answers were correct. Take a test now to see what stuck.', { r: right, n: results.current.length })}</p>
              <div className="row">
                <button className="btn btn-primary btn-lg" onClick={() => navigate(`/set/${set.id}/test`)}>{t('Take a test')}</button>
                <button className="btn btn-lg" onClick={() => setSession((s) => s + 1)}>{t('Learn again')}</button>
              </div>
            </div>
          </div>
          {tough.length > 0 && (
            <section className="section">
              <div className="section-head"><h2>{t('Missed most often')}</h2></div>
              <div className="terms">
                {tough.map((it) => (
                  <div key={it.card.id} className="term-row">
                    <div className="t">{it.card.term}</div>
                    <div className="d">{it.card.definition}</div>
                    <div className="acts"><span className="badge-no" style={{ margin: 10 }}>{t('{n}× wrong', { n: it.wrongs })}</span></div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div></div>
        {opts}
      </div>
    )
  }

  if (phase === 'checkpoint') {
    return (
      <div className="study">
        {header}
        <div className="study-body"><div className="study-inner">
          {track}
          <div className="q-card">
            <h1>{t('You’re making progress!')}</h1>
            <p className="muted">{t('Round complete. Here are the terms from this round:')}</p>
            <div className="terms" style={{ marginTop: 18 }}>
              {roundItems.current.map((it) => (
                <div key={it.card.id} className="term-row">
                  <div className="t">{it.card.term}</div>
                  <div className="d">{it.card.definition}</div>
                  <div className="acts">{it.done ? <span className="badge-ok" style={{ margin: 10 }}><Check size={14} /> {t('Mastered')}</span> : <span className="pill" style={{ margin: 10 }}>{t('Keep practicing')}</span>}</div>
                </div>
              ))}
            </div>
          </div>
        </div></div>
        <div className="continue-bar"><div className="inner"><span className="muted">{t('Press')} <kbd>Enter</kbd> {t('to continue')}</span><button className="btn btn-primary btn-lg" autoFocus onClick={() => { roundItems.current = []; ask() }}>{t('Continue')}</button></div></div>
        {opts}
      </div>
    )
  }

  if (!q) return header
  const label = q.p.dir === 'td' ? t('Term') : t('Definition')
  const answered = phase === 'feedback' && fb
  const praise = t(PRAISE[results.current.length % PRAISE.length])

  return (
    <div className="study">
      {header}
      <div className="study-body">
        <div className="study-inner">
          {track}
          <div className="q-card" key={q.item.card.id + results.current.length}>
            <div className="q-top">
              {label}
              <button className="icon-btn" onClick={() => speak(q.p.q, q.p.qLang)} aria-label={t('Read aloud')} style={{ width: 32, height: 32 }}><Volume2 size={18} /></button>
              <span className="spacer" />
              {q.item.wrongs > 0 && !answered && <span className="pill">{t('Let’s try again')}</span>}
            </div>

            {q.type === 'tf' ? (
              <div className="tf-pair">
                <div><div className="q-text">{q.p.q}</div></div>
                <div className="rule" />
                <div><div className="q-top">{q.p.dir === 'td' ? t('Definition') : t('Term')}</div><div className="q-text">{q.shown}</div></div>
              </div>
            ) : (
              <div className="q-text">{q.p.q}</div>
            )}

            {answered ? (
              <div className={`q-prompt ${fb.ok ? 'good' : 'bad'}`}>
                {fb.ok ? (fb.kind === 'typo' ? t('Almost – watch the spelling.') : praise) : fb.skipped ? t('No problem. Remember this answer:') : t('Not quite, you’re still learning!')}
              </div>
            ) : (
              <div className="q-prompt">{q.type === 'write' ? t('Your answer') : q.type === 'tf' ? t('Is this right?') : t('Choose the correct answer')}</div>
            )}

            {q.type === 'mc' && (
              <div className="choices">
                {q.options.map((opt, k) => {
                  const right = opt === q.p.a
                  const cls = answered ? (right ? 'right' : fb.chosen === k ? 'wrong' : 'dim') : ''
                  return (
                    <button key={k} className={`choice ${cls}`} disabled={!!answered} onClick={() => choose(k)}>
                      <span className="key">{answered && right ? <Check size={15} /> : answered && fb.chosen === k ? <X size={15} /> : k + 1}</span>
                      <span>{opt}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {q.type === 'tf' && (
              <div className="choices">
                {[true, false].map((v, k) => {
                  const right = v === q.truth
                  const cls = answered ? (right ? 'right' : fb.chosen === (v ? 1 : 0) ? 'wrong' : 'dim') : ''
                  return (
                    <button key={k} className={`choice ${cls}`} disabled={!!answered} onClick={() => chooseTf(v)}>
                      <span className="key">{k + 1}</span><span>{v ? t('True') : t('False')}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {q.type === 'tf' && answered && !q.truth && (
              <div className="compare" style={{ marginTop: 14 }}><div className="correct"><small>{t('Correct answer')}</small>{q.p.a}</div></div>
            )}

            {q.type === 'write' && !answered && (
              <form onSubmit={(e) => { e.preventDefault(); if (typed.trim()) submitWrite() }}>
                <input ref={inputRef} className="answer-input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t('Type the answer')} aria-label={t('Your answer')} autoComplete="off" spellCheck={false} />
                <div className="answer-actions">
                  <button type="button" className="link-btn" onClick={() => submitWrite(true)}>{t('Don’t know?')}</button>
                  <button type="submit" className="btn btn-primary" disabled={!typed.trim()}>{t('Answer')}</button>
                </div>
              </form>
            )}
            {q.type === 'write' && answered && (
              <div className="compare">
                {(!fb.ok || fb.kind === 'typo') && !fb.skipped && (
                  <div className={`yours ${fb.kind === 'typo' ? 'typo' : ''}`}><small>{t('Your answer')}</small>{fb.typed}</div>
                )}
                <div className="correct"><small>{t('Correct answer')}</small>{q.p.a}</div>
              </div>
            )}
            {answered && q.item.card.example && <div className="example-line">{q.item.card.example}</div>}
          </div>
        </div>
      </div>
      {answered && (!fb.ok || fb.kind === 'typo') && (
        <div className="continue-bar">
          <div className="inner">
            <span className="muted">{t('Press')} <kbd>Enter</kbd> {t('to continue')}</span>
            <div className="row">
              {q.type === 'write' && !fb.ok && !fb.skipped && <button className="btn btn-ghost" onClick={override}>{t('I was right')}</button>}
              <button className="btn btn-primary btn-lg" autoFocus onClick={next}>{t('Continue')}</button>
            </div>
          </div>
        </div>
      )}
      {opts}
    </div>
  )
}
