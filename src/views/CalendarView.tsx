import { useMemo, useState } from 'react'
import { WEEKDAYS, fmtShortDay } from '../lib/format'
import { LEVEL_LABEL, aggregateByDay, dayKey, firstDay, keyOfDate, level, type Level } from '../lib/stats'
import { useData } from '../lib/store'
import { STANDARDS, fmtGrams, fmtUnits, unitsToGrams } from '../lib/units'

export function CalendarView({ now, onDay }: { now: number; onDay: (key: string) => void }) {
  const { entries, settings } = useData()
  const today = dayKey(now, settings.dayStartHour)
  const first = firstDay(entries, settings.dayStartHour)
  const byDay = useMemo(() => aggregateByDay(entries, settings), [entries, settings])
  const [cursor, setCursor] = useState(() => {
    const d = new Date(now)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const unit = STANDARDS[settings.standard].short

  /** "none" = outside tracked range (future, or before first log) */
  const cell = (key: string): Level | 'none' => {
    if (key > today || !first || key < first) return 'none'
    return level(byDay.get(key)?.units ?? 0, settings.dailyLimit)
  }

  // Month grid, Monday first.
  const monthStart = new Date(cursor.y, cursor.m, 1)
  const lead = (monthStart.getDay() + 6) % 7
  const daysIn = new Date(cursor.y, cursor.m + 1, 0).getDate()
  const keys = Array.from({ length: daysIn }, (_, i) => keyOfDate(new Date(cursor.y, cursor.m, i + 1)))
  let mUnits = 0, mDrinking = 0, mDry = 0
  for (const k of keys) {
    const c = cell(k)
    if (c === 'none') continue
    if (c === 0) mDry++
    else mDrinking++
    mUnits += byDay.get(k)?.units ?? 0
  }
  const shift = (n: number) => setCursor(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }))
  const nowMonth = new Date(now)
  const atCurrent = cursor.y === nowMonth.getFullYear() && cursor.m === nowMonth.getMonth()

  // Year in dots: one row per month, last 12 months.
  const rows = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(nowMonth.getFullYear(), nowMonth.getMonth() - 11 + i, 1)
    const n = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    return {
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      y: d.getFullYear(),
      m: d.getMonth(),
      keys: Array.from({ length: n }, (_, j) => keyOfDate(new Date(d.getFullYear(), d.getMonth(), j + 1))),
    }
  })

  const tip = (k: string) => {
    const t = byDay.get(k)
    const c = cell(k)
    return `${fmtShortDay(k)}: ${c === 'none' ? 'not tracked' : `${fmtUnits(t?.units ?? 0)} ${unit} (${fmtGrams(unitsToGrams(t?.units ?? 0, settings.standard))}) · ${LEVEL_LABEL[c]}`}`
  }

  return (
    <div className="view">
      <section className="card">
        <header className="month-head">
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month">
            ‹
          </button>
          <h2>{monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
          <button className="icon-btn" onClick={() => shift(1)} disabled={atCurrent} aria-label="Next month">
            ›
          </button>
        </header>
        <div className="cal-grid">
          {WEEKDAYS.map((w) => (
            <span key={w} className="cal-dow">
              {w[0]}
            </span>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <span key={`l${i}`} />
          ))}
          {keys.map((k, i) => {
            const c = cell(k)
            const u = byDay.get(k)?.units ?? 0
            return (
              <button key={k} className={`cal-day${k === today ? ' today' : ''}`} onClick={() => onDay(k)} title={tip(k)} aria-label={tip(k)}>
                <span className="cal-num">{i + 1}</span>
                <span className={`dot ${c === 'none' ? 'none' : `lv${c}`}`} />
                <span className="cal-units">{u > 0 ? fmtUnits(u) : ''}</span>
              </button>
            )
          })}
        </div>
        <div className="month-stats">
          <span>
            <strong>{fmtUnits(mUnits)}</strong> {unit}
            <span className="grams"> · {fmtGrams(unitsToGrams(mUnits, settings.standard))}</span>
          </span>
          <span>
            <strong>{mDrinking}</strong> drinking
          </span>
          <span>
            <strong>{mDry}</strong> dry
          </span>
        </div>
      </section>

      <section className="card">
        <h3 className="section-title">Your year in dots</h3>
        <div className="year">
          {rows.map((r) => (
            <div className="year-row" key={`${r.y}-${r.m}`}>
              <button className="year-label" onClick={() => setCursor({ y: r.y, m: r.m })}>
                {r.label}
              </button>
              <div className="year-dots">
                {r.keys.map((k) => {
                  const c = cell(k)
                  return <button key={k} className={`dot sm ${c === 'none' ? 'none' : `lv${c}`}`} title={tip(k)} aria-label={tip(k)} onClick={() => onDay(k)} />
                })}
              </div>
            </div>
          ))}
        </div>
        <Legend limit={settings.dailyLimit} unit={unit} />
      </section>
    </div>
  )
}

export function Legend({ limit, unit }: { limit: number; unit: string }) {
  const items: [Level, string][] = [
    [0, 'Dry'],
    [1, `≤ ${fmtUnits(limit / 2)}`],
    [2, `≤ ${limit}`],
    [3, `≤ ${limit * 2}`],
    [4, `> ${limit * 2}`],
  ]
  return (
    <div className="legend">
      {items.map(([lv, label]) => (
        <span key={lv}>
          <span className={`dot sm lv${lv}`} /> {label}
        </span>
      ))}
      <span className="muted">{unit}/day</span>
    </div>
  )
}
