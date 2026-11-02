import { useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useT } from '../lib/settings'

/** Bildmarke: zwei versetzte Karteikarten mit Haken – folgt der Akzentfarbe */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ color: 'var(--primary)' }}>
      <rect x="3" y="7" width="20" height="16" rx="4" fill="currentColor" opacity="0.4" transform="rotate(-8 13 15)" />
      <rect x="8" y="9" width="21" height="16" rx="4" fill="currentColor" />
      <path d="M13.5 16.8l2.8 2.8 5.2-5.6" fill="none" style={{ stroke: 'var(--on-primary)' }} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Ausklappmenü, schließt bei Klick außerhalb oder Escape */
export function Menu({ button, children, align = 'right' }: { button: (open: () => void, isOpen: boolean) => ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <div className="menu-wrap" ref={ref}>
      {button(() => setOpen((o) => !o), open)}
      {open && <div className={`menu ${align}`} role="menu">{children(() => setOpen(false))}</div>}
    </div>
  )
}

export function Dialog({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const { t } = useT()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`dialog ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="dialog-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('Close')}><X size={22} /></button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>
  )
}

/** Ergebnis-Ring (Prozent) */
export function Ring({ value, color = 'var(--known)' }: { value: number; color?: string }) {
  const r = 56
  const c = 2 * Math.PI * r
  const [shown, setShown] = useState(0)
  useEffect(() => { const id = requestAnimationFrame(() => setShown(value)); return () => cancelAnimationFrame(id) }, [value])
  return (
    <div className="ring">
      <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
        <circle cx="66" cy="66" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="12" />
        <circle cx="66" cy="66" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - shown / 100)} />
      </svg>
      <div className="val">{value}%</div>
    </div>
  )
}

/** Fortschritt nach Lernstand: gewusst / noch am Lernen / nicht gelernt */
export function StatusBar({ known, learning, total }: { known: number; learning: number; total: number }) {
  const { t } = useT()
  const k = total ? (known / total) * 100 : 0
  const l = total ? (learning / total) * 100 : 0
  return (
    <div className="status-bar" role="img" aria-label={t('{k} known, {l} still learning, {n} not studied', { k: known, l: learning, n: total - known - learning })}>
      <i style={{ width: `${k}%`, background: 'var(--known)' }} />
      <i style={{ width: `${l}%`, background: 'var(--learning)' }} />
    </div>
  )
}
