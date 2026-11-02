import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { Dialog } from './ui'
import { ACCENTS, DEFAULT_ACCENT, onAccent, useSettings, type CardSize, type Lang, type Theme } from '../lib/settings'

export default function SettingsDialog({ onClose }: { onClose(): void }) {
  const { settings: s, update, t } = useSettings()
  const custom = !ACCENTS.some((a) => a.color.toLowerCase() === s.accent.toLowerCase())
  return (
    <Dialog
      title={t('Settings')}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => update({ accent: DEFAULT_ACCENT, theme: 'system', cardSize: 'medium' })}>{t('Reset look')}</button>
          <span className="spacer" />
          <button className="btn btn-primary" onClick={onClose}>{t('Done')}</button>
        </>
      }
    >
      <div className="opt-group">
        <h3>{t('Language')}</h3>
        <div className="seg" role="group" aria-label={t('Language')}>
          {([['en', 'English'], ['de', 'Deutsch']] as [Lang, string][]).map(([l, label]) => (
            <button key={l} className={s.lang === l ? 'on' : ''} onClick={() => update({ lang: l })}>{label}</button>
          ))}
        </div>
      </div>

      <div className="opt-group">
        <h3>{t('Appearance')}</h3>
        <div className="seg" role="group" aria-label={t('Appearance')}>
          {([['light', Sun, 'Light'], ['dark', Moon, 'Dark'], ['system', Monitor, 'Like Windows']] as [Theme, typeof Sun, string][]).map(([th, Icon, label]) => (
            <button key={th} className={s.theme === th ? 'on' : ''} onClick={() => update({ theme: th })}>
              <Icon size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{t(label)}
            </button>
          ))}
        </div>
      </div>

      <div className="opt-group">
        <h3>{t('Accent color')}</h3>
        <div className="swatches">
          {ACCENTS.map((a) => {
            const on = a.color.toLowerCase() === s.accent.toLowerCase()
            return (
              <button
                key={a.color}
                className={`swatch ${on ? 'on' : ''}`}
                style={{ background: a.color, color: onAccent(a.color) }}
                onClick={() => update({ accent: a.color })}
                aria-label={t(a.name)}
                aria-pressed={on}
                title={t(a.name)}
              >
                {on && <Check size={18} strokeWidth={3} />}
              </button>
            )
          })}
          <label className={`swatch custom ${custom ? 'on' : ''}`} title={t('Custom color')} style={custom ? { background: s.accent } : undefined}>
            <input type="color" value={s.accent} onChange={(e) => update({ accent: e.target.value })} aria-label={t('Custom color')} />
            {custom ? <Check size={18} strokeWidth={3} /> : '+'}
          </label>
        </div>
      </div>

      <div className="opt-group">
        <h3>{t('Flashcard text size')}</h3>
        <div className="seg" role="group" aria-label={t('Flashcard text size')}>
          {([['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']] as [CardSize, string][]).map(([c, label]) => (
            <button key={c} className={s.cardSize === c ? 'on' : ''} onClick={() => update({ cardSize: c })}>{t(label)}</button>
          ))}
        </div>
      </div>
    </Dialog>
  )
}
