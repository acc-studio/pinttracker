import { useMemo, useState } from 'react'
import { BarChart, HBars } from '../components/BarChart'
import { WEEKDAYS, fmtDay, fmtHour, fmtShortDay } from '../lib/format'
import { addDays, aggregateByDay, currentDryStreak, dayKey, firstDay, summarize } from '../lib/stats'
import { useData } from '../lib/store'
import { KIND_LABEL } from '../lib/types'
import { STANDARDS, fmtGrams, fmtMoney, fmtUnits, unitsToGrams } from '../lib/units'

const RANGES = [
  { id: '4w', label: '4 weeks', days: 28 },
  { id: '3m', label: '3 months', days: 91 },
  { id: '12m', label: '12 months', days: 365 },
  { id: 'all', label: 'All time', days: Infinity },
] as const

export function StatsView({ now, onDay }: { now: number; onDay: (k: string) => void }) {
  const { entries, settings } = useData()
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('4w')
  const today = dayKey(now, settings.dayStartHour)
  const first = firstDay(entries, settings.dayStartHour)
  const r = RANGES.find((x) => x.id === range)!
  const from = r.days === Infinity ? (first ?? today) : addDays(today, -(r.days - 1))
  const s = useMemo(() => summarize(entries, settings, from, today), [entries, settings, from, today])
  const dry = useMemo(() => currentDryStreak(aggregateByDay(entries, settings), today, first), [entries, settings, today, first])
  const unit = STANDARDS[settings.standard].short

  if (!entries.length) {
    return (
      <div className="view">
        <div className="empty">
          <span className="big-emoji">📊</span>
          <p>Log a few drinks and your stats will show up here.</p>
        </div>
      </div>
    )
  }

  // Hours ordered from the start of the drinking day (e.g. 5am → 4am).
  const hourOrder = Array.from({ length: 24 }, (_, i) => (i + settings.dayStartHour) % 24)
  const weekAvgOver = s.avgPerWeek > settings.weeklyLimit
  const dryPct = s.days ? Math.round((s.dryDays / s.days) * 100) : 0

  return (
    <div className="view">
      <div className="seg" role="tablist">
        {RANGES.map((x) => (
          <button key={x.id} role="tab" aria-selected={range === x.id} className={range === x.id ? 'on' : ''} onClick={() => setRange(x.id)}>
            {x.label}
          </button>
        ))}
      </div>
      <p className="muted small center">
        {fmtShortDay(s.from)} – {fmtShortDay(s.to)} · {s.days} days
      </p>

      <section className="tiles">
        <Tile label="Avg per week" value={fmtUnits(s.avgPerWeek)} sub={`${unit} · ${fmtGrams(unitsToGrams(s.avgPerWeek, settings.standard))} · limit ${settings.weeklyLimit}`} tone={weekAvgOver ? 'bad' : 'good'} />
        <Tile label="Dry days" value={`${dryPct}%`} sub={`${s.dryDays} of ${s.days} days`} tone={dryPct >= 50 ? 'good' : undefined} />
        <Tile label="Dry streak now" value={`${dry}`} sub={dry === 1 ? 'day' : 'days'} />
        <Tile label="Longest dry run" value={`${s.longestDry}`} sub="days in period" />
        <Tile label="Total" value={fmtUnits(s.units)} sub={`${unit} · ${fmtGrams(unitsToGrams(s.units, settings.standard))} · ${s.drinks} drinks`} />
        <Tile label="Per drinking day" value={fmtUnits(s.avgPerDrinkingDay)} sub={`${unit} avg · ${fmtGrams(unitsToGrams(s.avgPerDrinkingDay, settings.standard))}`} tone={s.avgPerDrinkingDay > settings.dailyLimit ? 'bad' : undefined} />
        <Tile label="Over daily limit" value={`${s.overDays}`} sub={`days · ${s.weeksOverLimit} weeks over`} tone={s.overDays > 0 ? 'bad' : 'good'} />
        <Tile
          label="Heaviest day"
          value={s.heaviest ? fmtUnits(s.heaviest.units) : '–'}
          sub={s.heaviest ? fmtDay(s.heaviest.key, { day: 'numeric', month: 'short', year: '2-digit' }) : 'none yet'}
          onClick={s.heaviest ? () => onDay(s.heaviest!.key) : undefined}
        />
        <Tile label="Spent" value={s.spend ? fmtMoney(s.spend, settings.currency) : '–'} sub={s.spend ? 'where priced' : 'add prices to track'} />
        <Tile label="Calories" value={`≈${Math.round(s.kcal).toLocaleString()}`} sub={`kcal · ${Math.round(s.kcal / 550)} burgers`} />
      </section>

      <section className="card">
        <h3 className="section-title">{unit} per week</h3>
        <BarChart
          bars={s.weeks.map((w) => ({
            label: fmtDay(w.start, { day: 'numeric', month: 'numeric' }),
            detail: `Week of ${fmtShortDay(w.start)}: ${fmtUnits(w.units)} ${unit} (${fmtGrams(unitsToGrams(w.units, settings.standard))})`,
            value: w.units,
            hot: w.units > settings.weeklyLimit,
          }))}
          refLine={settings.weeklyLimit}
          refLabel={`limit ${settings.weeklyLimit}`}
          axisEvery={Math.ceil(s.weeks.length / 7)}
        />
      </section>

      <section className="card">
        <h3 className="section-title">Average by weekday</h3>
        <BarChart
          bars={s.byWeekday.map((v, i) => ({ label: WEEKDAYS[i], detail: `${WEEKDAYS[i]}: ${fmtUnits(v)} ${unit} (${fmtGrams(unitsToGrams(v, settings.standard))}) on average`, value: v, hot: v > settings.dailyLimit }))}
          height={110}
        />
      </section>

      <section className="card">
        <h3 className="section-title">When you drink</h3>
        <BarChart
          bars={hourOrder.map((h) => ({ label: fmtHour(h), detail: `${fmtHour(h)}–${fmtHour((h + 1) % 24)}: ${s.byHour[h]} drinks`, value: s.byHour[h] }))}
          axisEvery={6}
          height={100}
        />
      </section>

      {s.byKind.length > 0 && (
        <section className="card">
          <h3 className="section-title">By type</h3>
          <HBars rows={s.byKind.map((k) => ({ label: KIND_LABEL[k.kind], value: k.units, display: `${fmtUnits(k.units)} ${unit}`, sub: `${fmtGrams(unitsToGrams(k.units, settings.standard))}` }))} />
        </section>
      )}

      {s.top.length > 0 && (
        <section className="card">
          <h3 className="section-title">Usual order</h3>
          <ol className="top-list">
            {s.top.map((t) => (
              <li key={t.emoji + t.name}>
                <span>
                  {t.emoji} {t.name}
                </span>
                <span className="muted">×{t.count}</span>
              </li>
            ))}
          </ol>
          {s.water > 0 && <p className="muted small">💧 {s.water} waters logged alongside</p>}
        </section>
      )}

      <p className="muted small center pad">Units and calories are estimates. Guideline limits are adjustable in Settings.</p>
    </div>
  )
}

function Tile({ label, value, sub, tone, onClick }: { label: string; value: string; sub: string; tone?: 'good' | 'bad'; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className={`tile${tone ? ` ${tone}` : ''}`} onClick={onClick}>
      <span className="tile-label">{label}</span>
      <span className="tile-value">
        {value}
        {tone && <span className="tile-flag" aria-label={tone === 'good' ? 'on track' : 'over'}>{tone === 'good' ? ' ✓' : ' ↑'}</span>}
      </span>
      <span className="tile-sub">{sub}</span>
    </Tag>
  )
}
