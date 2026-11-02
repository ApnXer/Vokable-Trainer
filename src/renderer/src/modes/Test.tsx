import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Volume2, X } from 'lucide-react'
import type { Card, ProgressResult, StudySet } from '@shared/types'
import { checkAnswer } from '@shared/text'
import StudyHeader from '../components/StudyHeader'
import { Dialog, Ring } from '../components/ui'
import { buildDeck, distractors, loadOpts, pct, qa, saveOpts, shuffle, speak, usable, type QA, type StudyOpts } from '../lib/study'
import { useT } from '../lib/settings'
import { NotFound, useEscToClose, useStudySet } from './common'

type QType = 'tf' | 'mc' | 'match' | 'write'
interface Q { type: Exclude<QType, 'match'>; card: Card; p: QA; options: string[]; shown: string; truth: boolean }
interface MatchBlock { pairs: { card: Card; p: QA }[]; choices: string[] }
interface TestData { questions: Q[]; match: MatchBlock | null }

const TYPE_LABEL: Record<QType, string> = { tf: 'True / False', mc: 'Multiple choice', match: 'Matching', write: 'Written' }

function generate(set: StudySet, o: StudyOpts): TestData {
  const canChoice = usable(set).length >= 2
  let types = (['tf', 'mc', 'match', 'write'] as QType[]).filter((t) => o.test[t] && (canChoice || t === 'write'))
  if (!types.length) types = ['write']
  const pool = buildDeck(set, { ...o, shuffle: true }).slice(0, Math.max(1, o.test.count))
  const wantsMatch = types.includes('match') && pool.length >= 2
  const others = types.filter((t) => t !== 'match') as Q['type'][]
  if (!others.length && !wantsMatch) others.push('write')
  const matchN = !wantsMatch ? 0 : !others.length ? Math.min(pool.length, 10) : Math.min(6, Math.max(2, Math.round(pool.length / types.length)))
  const matchCards = pool.slice(0, matchN)
  const questions: Q[] = pool.slice(matchN).map((card, k) => {
    const type = others[k % others.length]
    const p = qa(card, set, o.dir)
    const wrong = distractors(set, card, p.dir, 3, p.a)
    const truth = Math.random() < 0.5 || !wrong.length
    return { type, card, p, options: shuffle([p.a, ...wrong]), shown: truth ? p.a : wrong[0], truth }
  })
  // Reihenfolge wie bei Quizlet: nach Fragetyp gruppiert
  const order: Q['type'][] = ['tf', 'mc', 'write']
  questions.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
  const pairs = matchCards.map((card) => ({ card, p: qa(card, set, o.dir) }))
  return { questions, match: pairs.length ? { pairs, choices: shuffle(pairs.map((x) => x.p.a)) } : null }
}

export default function Test() {
  const { set } = useStudySet()
  if (set === undefined) return null
  if (set === null) return <NotFound />
  return <TestSession set={set} />
}

function TestSession({ set }: { set: StudySet }) {
  const navigate = useNavigate()
  const { t, tn } = useT()
  const [o, setO] = useState<StudyOpts>(loadOpts)
  const [setup, setSetup] = useState(true)
  const [data, setData] = useState<TestData | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [graded, setGraded] = useState<null | { score: number; total: number; ok: Record<string, boolean> }>(null)
  useEscToClose(set.id, !setup)
  const max = usable(set).length
  const toTop = () => requestAnimationFrame(() => document.querySelector('.study-body')?.scrollTo({ top: 0 }))

  const start = () => {
    saveOpts(o)
    setData(generate(set, o))
    setAnswers({}); setGraded(null); setSetup(false)
    toTop()
  }

  const qKeys = data ? [...data.questions.map((_, i) => `q${i}`), ...(data.match?.pairs.map((_, i) => `m${i}`) ?? [])] : []
  const answeredN = qKeys.filter((k) => answers[k]?.trim()).length

  const answer = (key: string, value: string, scrollNext = false) => {
    setAnswers((a) => ({ ...a, [key]: value }))
    if (scrollNext) {
      const idx = Number(key.slice(1))
      window.setTimeout(() => document.getElementById(`tq${idx + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
    }
  }

  const submit = async () => {
    if (!data) return
    const open = qKeys.length - answeredN
    if (open && !confirm(tn(open, '{n} question is still unanswered. Submit anyway?', '{n} questions are still unanswered. Submit anyway?'))) return
    const ok: Record<string, boolean> = {}
    const results: ProgressResult[] = []
    data.questions.forEach((q, i) => {
      const v = answers[`q${i}`] ?? ''
      ok[`q${i}`] = q.type === 'write' ? !!v && checkAnswer(v, q.p.a) !== 'wrong' : q.type === 'tf' ? v !== '' && (v === 'true') === q.truth : v === q.p.a
      results.push({ cardId: q.card.id, correct: ok[`q${i}`] })
    })
    data.match?.pairs.forEach((m, i) => {
      ok[`m${i}`] = answers[`m${i}`] === m.p.a
      results.push({ cardId: m.card.id, correct: ok[`m${i}`] })
    })
    const score = Object.values(ok).filter(Boolean).length
    setGraded({ score, total: qKeys.length, ok })
    toTop()
    await window.api.recordProgress(set.id, results, { score, total: qKeys.length })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && data && !graded) submit() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const status = graded ? t('{s} / {n} correct', { s: graded.score, n: graded.total }) : data ? t('{a} / {n} answered', { a: answeredN, n: qKeys.length }) : t('Set up test')
  const setupDialog = setup && (
    <Dialog
      title={t('Set up your test')}
      onClose={() => (data ? setSetup(false) : navigate(`/set/${set.id}`))}
      footer={<><span className="spacer" /><button className="btn btn-primary btn-lg" onClick={start} disabled={!max}>{t('Start test')}</button></>}
    >
      <div className="opt-group">
        <label className="opt-line">
          <span>{t('Questions')} <span className="muted">{t('(max {n})', { n: max })}</span></span>
          <input className="input" type="number" min={1} max={max} style={{ width: 90 }} value={Math.min(o.test.count, max)} onChange={(e) => setO({ ...o, test: { ...o.test, count: Math.max(1, Math.min(max, Number(e.target.value) || 1)) } })} />
        </label>
        <div className="opt-line">
          <span>{t('Answer with')}</span>
          <div className="seg">
            {([['td', 'Definition'], ['dt', 'Term'], ['mix', 'Both']] as const).map(([d, l]) => (
              <button key={d} className={o.dir === d ? 'on' : ''} onClick={() => setO({ ...o, dir: d })}>{t(l)}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="opt-group">
        {(['tf', 'mc', 'match', 'write'] as QType[]).map((k) => (
          <label key={k} className="opt-line">
            <span>{t(TYPE_LABEL[k])}</span>
            <span className="switch"><input type="checkbox" checked={o.test[k]} onChange={(e) => setO({ ...o, test: { ...o.test, [k]: e.target.checked } })} /></span>
          </label>
        ))}
      </div>
    </Dialog>
  )

  if (!data) return <div className="study"><StudyHeader setId={set.id} mode="test" title={set.title} status={status} />{setupDialog}</div>

  return (
    <div className="study">
      <StudyHeader setId={set.id} mode="test" title={set.title} status={status} progress={graded ? 1 : answeredN / Math.max(1, qKeys.length)} onSettings={() => setSetup(true)} />
      <div className="study-body">
        <div className="study-inner">
          {graded && (
            <>
              <div className="result-head">
                <Ring value={pct(graded.score, graded.total)} color={pct(graded.score, graded.total) >= 50 ? 'var(--known)' : 'var(--learning)'} />
                <div>
                  <h1>{pct(graded.score, graded.total) >= 90 ? t('Outstanding!') : pct(graded.score, graded.total) >= 70 ? t('Nice work!') : t('You can do this! Keep studying to improve your score.')}</h1>
                  <div className="score-lines" style={{ margin: '12px 0 18px' }}>
                    <span className="k">{t('Correct: {n}', { n: graded.score })}</span>
                    <span className="l">{t('Incorrect: {n}', { n: graded.total - graded.score })}</span>
                  </div>
                  <div className="row">
                    {graded.score < graded.total && (
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          const wrongIds = [...data.questions.map((q, i) => (!graded.ok[`q${i}`] ? q.card.id : '')), ...(data.match?.pairs.map((m, i) => (!graded.ok[`m${i}`] ? m.card.id : '')) ?? [])].filter(Boolean)
                          navigate(`/set/${set.id}/learn`, { state: { ids: wrongIds } })
                        }}
                      >
                        {t('Study missed terms')}
                      </button>
                    )}
                    <button className="btn" onClick={() => setSetup(true)}>{t('Take a new test')}</button>
                  </div>
                </div>
              </div>
              <h2 style={{ margin: '32px 0 4px' }}>{t('Your answers')}</h2>
            </>
          )}

          {data.questions.map((q, i) => {
            const key = `q${i}`
            const v = answers[key] ?? ''
            const res = graded?.ok[key]
            const label = q.p.dir === 'td' ? t('Term') : t('Definition')
            return (
              <div key={key} id={`tq${i}`} className={`q-card test-q ${v ? 'answered' : ''}`}>
                <div className="q-top">
                  {label}
                  <button className="icon-btn" onClick={() => speak(q.p.q, q.p.qLang)} aria-label={t('Read aloud')} style={{ width: 32, height: 32 }}><Volume2 size={18} /></button>
                  <span className="spacer" />
                  {graded ? (res ? <span className="badge-ok"><Check size={14} /> {t('Correct')}</span> : <span className="badge-no"><X size={14} /> {t('Incorrect')}</span>) : <span>{t('{i} of {n}', { i: i + 1, n: qKeys.length })}</span>}
                </div>
                {q.type === 'tf' ? (
                  <div className="tf-pair">
                    <div className="q-text">{q.p.q}</div>
                    <div className="rule" />
                    <div className="q-text">{q.shown}</div>
                  </div>
                ) : (
                  <div className="q-text">{q.p.q}</div>
                )}
                <div className="q-prompt">{q.type === 'write' ? t('Your answer') : q.type === 'tf' ? t('Choose an answer') : t('Choose the correct answer')}</div>

                {q.type === 'mc' && (
                  <div className="choices">
                    {q.options.map((opt, k) => {
                      const cls = graded ? (opt === q.p.a ? 'right' : v === opt ? 'wrong' : 'dim') : v === opt ? 'selected' : ''
                      return (
                        <button key={k} className={`choice ${cls}`} disabled={!!graded} onClick={() => answer(key, opt, true)}>
                          <span className="key">{String.fromCharCode(65 + k)}</span><span>{opt}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                {q.type === 'tf' && (
                  <div className="choices">
                    {[true, false].map((b) => {
                      const sel = v === String(b)
                      const cls = graded ? (b === q.truth ? 'right' : sel ? 'wrong' : 'dim') : sel ? 'selected' : ''
                      return (
                        <button key={String(b)} className={`choice ${cls}`} disabled={!!graded} onClick={() => answer(key, String(b), true)}>
                          <span>{b ? t('True') : t('False')}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                {q.type === 'tf' && graded && !q.truth && <div className="compare" style={{ marginTop: 12 }}><div className="correct"><small>{t('Correct answer')}</small>{q.p.a}</div></div>}
                {q.type === 'write' && (
                  graded ? (
                    <div className="compare">
                      {!res && <div className="yours"><small>{t('Your answer')}</small>{v || t('(no answer)')}</div>}
                      <div className="correct"><small>{res ? t('Your answer') : t('Correct answer')}</small>{res ? v : q.p.a}</div>
                    </div>
                  ) : (
                    <input
                      className="answer-input"
                      value={v}
                      onChange={(e) => answer(key, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById(`tq${i + 1}`)?.scrollIntoView({ behavior: 'smooth' }); (document.querySelector(`#tq${i + 1} input`) as HTMLInputElement | null)?.focus({ preventScroll: true }) } }}
                      placeholder={t('Type the answer')}
                      autoComplete="off"
                      spellCheck={false}
                      aria-label={t('Answer to question {n}', { n: i + 1 })}
                    />
                  )
                )}
              </div>
            )
          })}

          {data.match && (
            <div className="q-card test-q" id={`tq${data.questions.length}`}>
              <div className="q-top">{t('Matching')}<span className="spacer" />{!graded && <span>{tn(data.match.pairs.length, '{n} pair', '{n} pairs')}</span>}</div>
              <div className="q-prompt" style={{ marginTop: 14 }}>{t('Pick the matching answer for each item')}</div>
              {data.match.pairs.map((m, i) => {
                const key = `m${i}`
                const res = graded?.ok[key]
                return (
                  <div key={key} className="match-row">
                    <b>{m.p.q}</b>
                    {graded ? (
                      <div>
                        {res ? <span className="badge-ok"><Check size={14} /> {m.p.a}</span> : (
                          <><span className="badge-no"><X size={14} /> {answers[key] || t('no answer')}</span><div className="small" style={{ color: 'var(--known-ink)', marginTop: 4, fontWeight: 600 }}>{t('Correct: {a}', { a: m.p.a })}</div></>
                        )}
                      </div>
                    ) : (
                      <select className="select" value={answers[key] ?? ''} onChange={(e) => answer(key, e.target.value)} aria-label={t('Answer for {q}', { q: m.p.q })}>
                        <option value="">{t('Choose an answer …')}</option>
                        {data.match!.choices.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {!graded && (
            <div className="submit-zone">
              <p>{answeredN === qKeys.length ? t('All answered. Ready to submit?') : tn(qKeys.length - answeredN, '{n} question is still open.', '{n} questions are still open.')}</p>
              <button className="btn btn-primary btn-lg" onClick={submit}>{t('Submit test')}</button>
            </div>
          )}
        </div>
      </div>
      {setupDialog}
    </div>
  )
}
