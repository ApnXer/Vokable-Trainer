import { Star, Volume2 } from 'lucide-react'
import type { MouseEvent } from 'react'
import { useT } from '../lib/settings'

interface Props {
  front: string
  back: string
  frontLabel: string
  backLabel: string
  example?: string
  flipped: boolean
  onFlip(): void
  onSpeak?(side: 'front' | 'back'): void
  starred?: boolean
  onStar?(): void
  className?: string
  /** Wechselt bei jeder neuen Karte, damit die Einblend-Animation erneut läuft */
  animKey?: string
}

/** Karteikarte mit 3D-Umdrehen (Klick, Leertaste, W/S oder Pfeil hoch/runter) */
export default function Flashcard(p: Props) {
  const { t } = useT()
  const stop = (fn?: () => void) => (e: MouseEvent) => { e.stopPropagation(); fn?.() }
  const tools = (side: 'front' | 'back') => (
    <span className="row" style={{ gap: 0 }}>
      {p.onSpeak && (
        <button className="icon-btn" onClick={stop(() => p.onSpeak!(side))} aria-label={t('Read aloud')} title={t('Read aloud')}><Volume2 size={20} /></button>
      )}
      {p.onStar && (
        <button className={`icon-btn ${p.starred ? 'on' : ''}`} onClick={stop(p.onStar)} aria-label={p.starred ? t('Remove star') : t('Star')} title={t('Star')}>
          <Star size={20} />
        </button>
      )}
    </span>
  )
  return (
    <div
      key={p.animKey}
      className={`flip ${p.flipped ? 'flipped' : ''} ${p.className ?? ''}`}
      onClick={p.onFlip}
      role="button"
      tabIndex={0}
      aria-label={t('Flashcard – {side}: {text}. Click to flip.', { side: p.flipped ? p.backLabel : p.frontLabel, text: p.flipped ? p.back : p.front })}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); p.onFlip() } }}
    >
      <div className="flip-in">
        <div className="face front" aria-hidden={p.flipped}>
          <div className="face-top"><span>{p.frontLabel}</span>{tools('front')}</div>
          {p.front}
        </div>
        <div className="face back" aria-hidden={!p.flipped}>
          <div className="face-top"><span>{p.backLabel}</span>{tools('back')}</div>
          {p.back}
          {p.example && <div className="example">{p.example}</div>}
        </div>
      </div>
    </div>
  )
}
