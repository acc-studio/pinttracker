import { useRef } from 'react'
import { Ring } from '../components/Ring'
import { fmtAgo, fmtDay, fmtTime } from '../lib/format'
import { aggregateByDay, dayKey, weekStart } from '../lib/stats'
import { deleteEntry, useData, useSync } from '../lib/store'
import type { Entry, Preset } from '../lib/types'
import { STANDARDS, WATER, fmtGrams, fmtMoney, fmtUnits, stdUnits, unitsToGrams } from '../lib/units'
import { EntryAmount } from '../components/EntryAmount'

interface Props {
  now: number
  onQuickLog: (p: Preset) => void
  onCustom: (p?: Preset) => void
  onEdit: (e: Entry) => void
  onDeleted: (e: Entry) => void
  onOpenSettings: () => void
}

export function LogView({ now, onQuickLog, onCustom, onEdit, onDeleted, onOpenSettings }: Props) {
  const { entries, settings } = useData()
  const { user } = useSync()
  const today = dayKey(now, settings.dayStartHour)
  const week = weekStart(today)
  const tonight = entries.filter((e) => dayKey(e.ts, settings.dayStartHour) === today)
  const t = aggregateByDay(tonight, settings).get(today)
  const units = t?.units ?? 0
  let weekUnits = 0
  for (const [k, d] of aggregateByDay(entries, settings)) if (k >= week && k <= today) weekUnits += d.units
  const unit = STANDARDS[settings.standard].short
  const drinks = tonight.filter((e) => e.kind !== 'water')
  const last = drinks.at(-1)
  const lastHour = drinks.filter((e) => now - e.ts < 3_600_000).length
  const weekPct = Math.min(100, (weekUnits / settings.weeklyLimit) * 100)

  return (
    <div className="view log-view">
      <section className="hero">
        <Ring value={units} max={settings.dailyLimit}>
          <span className="hero-num">{fmtUnits(units)}</span>
          <span className="hero-unit">{unit} tonight</span>
          {units > 0 && <span className="grams hero-grams">{fmtGrams(unitsToGrams(units, settings.standard))} alcohol</span>}
        </Ring>
        <div className="hero-meta">
          <span className="muted">{fmtDay(today, { weekday: 'long', day: 'numeric', month: 'short' })}</span>
          <span>
            <strong>{t?.drinks ?? 0}</strong> drinks
            {(t?.water ?? 0) > 0 && <> · 💧 {t?.water}</>}
            {(t?.spend ?? 0) > 0 && <> · {fmtMoney(t!.spend, settings.currency)}</>}
          </span>
          {last && (
            <span className="muted small">
              last {fmtAgo(now - last.ts)}
              {lastHour >= 3 && <span className="pace"> · {lastHour} in the past hour — easy tiger 🐯</span>}
            </span>
          )}
        </div>
      </section>

      <section className="week-meter" aria-label="This week">
        <div className="week-meter-head">
          <span>This week</span>
          <span>
            <strong>{fmtUnits(weekUnits)}</strong> / {settings.weeklyLimit} {unit}
            <span className="grams"> · {fmtGrams(unitsToGrams(weekUnits, settings.standard))}</span>
          </span>
        </div>
        <div className="meter">
          <span className={weekUnits > settings.weeklyLimit ? 'over' : ''} style={{ width: `${weekPct}%` }} />
        </div>
      </section>

      <section className="preset-grid" aria-label="Quick log">
        {settings.presets.map((p) => (
          <PresetButton key={p.id} p={p} unit={fmtUnits(stdUnits(p, settings.standard))} onTap={() => onQuickLog(p)} onHold={() => onCustom(p)} />
        ))}
        <PresetButton p={WATER} unit="" onTap={() => onQuickLog(WATER)} onHold={() => onCustom(WATER)} className="water" />
        <button className="preset custom" onClick={() => onCustom()}>
          <span className="preset-emoji">＋</span>
          <span className="preset-name">Other…</span>
        </button>
      </section>
      <p className="muted small center hint">Tap to log · hold to tweak size, time or price</p>
      {(user === null || user?.anonymous) && entries.length > 0 && (
        <button className="sync-nudge" onClick={onOpenSettings}>
          ☁️ {user ? 'Backed up on this phone only' : 'Only on this device'} · <strong>Create account to sync</strong>
        </button>
      )}

      {tonight.length > 0 && (
        <section>
          <h3 className="section-title">Tonight</h3>
          <ul className="entry-list">
            {[...tonight].reverse().map((e) => (
              <li key={e.id}>
                <button className="entry" onClick={() => onEdit(e)}>
                  <span className="entry-emoji">{e.emoji}</span>
                  <span className="entry-main">
                    <span>{e.name}</span>
                    <span className="muted small">{fmtTime(e.ts)}</span>
                  </span>
                  <EntryAmount e={e} standard={settings.standard} />
                </button>
                <button
                  className="icon-btn"
                  aria-label={`Remove ${e.name}`}
                  onClick={() => {
                    deleteEntry(e.id)
                    onDeleted(e)
                  }}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function PresetButton({ p, unit, onTap, onHold, className = '' }: { p: Preset; unit: string; onTap: () => void; onHold: () => void; className?: string }) {
  const timer = useRef<number | undefined>(undefined)
  const held = useRef(false)
  const start = () => {
    held.current = false
    timer.current = window.setTimeout(() => {
      held.current = true
      onHold()
    }, 450)
  }
  const cancel = () => window.clearTimeout(timer.current)
  return (
    <button
      className={`preset ${className}`}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => !held.current && onTap()}
    >
      <span className="preset-emoji">{p.emoji}</span>
      <span className="preset-name">{p.name}</span>
      <span className="preset-ml">{p.ml} ml</span>
      {unit && <span className="preset-units">{unit}</span>}
    </button>
  )
}
