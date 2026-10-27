import type { DrinkKind, Entry, Settings } from './types'
import { kcal, stdUnits } from './units'

const HOUR = 3_600_000

// ---------- day keys ("YYYY-MM-DD", local time) ----------

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`
}

export function keyOfDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** The drinking day an instant belongs to: a 1am pint counts toward the night before. */
export function dayKey(ts: number, dayStartHour: number): string {
  return keyOfDate(new Date(ts - dayStartHour * HOUR))
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, n: number): string {
  const d = parseKey(key)
  d.setDate(d.getDate() + n)
  return keyOfDate(d)
}

export function daysBetween(a: string, b: string): number {
  // Round to absorb DST shifts.
  return Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / (24 * HOUR))
}

/** Monday of the week containing key. */
export function weekStart(key: string): string {
  const dow = (parseKey(key).getDay() + 6) % 7
  return addDays(key, -dow)
}

/** Monday = 0 … Sunday = 6 */
export function weekdayIndex(key: string): number {
  return (parseKey(key).getDay() + 6) % 7
}

// ---------- aggregation ----------

export interface DayTotal {
  units: number
  drinks: number
  water: number
  spend: number
  kcal: number
}

export function aggregateByDay(entries: Entry[], s: Pick<Settings, 'standard' | 'dayStartHour'>): Map<string, DayTotal> {
  const out = new Map<string, DayTotal>()
  for (const e of entries) {
    const k = dayKey(e.ts, s.dayStartHour)
    let t = out.get(k)
    if (!t) {
      t = { units: 0, drinks: 0, water: 0, spend: 0, kcal: 0 }
      out.set(k, t)
    }
    if (e.kind === 'water') {
      t.water += 1
      continue
    }
    t.units += stdUnits(e, s.standard)
    t.drinks += 1
    t.spend += e.price ?? 0
    t.kcal += kcal(e)
  }
  return out
}

/** 0 dry · 1 light (≤ half limit) · 2 moderate (≤ limit) · 3 over (≤ 2× limit) · 4 heavy */
export type Level = 0 | 1 | 2 | 3 | 4

export function level(units: number, dailyLimit: number): Level {
  if (units <= 0) return 0
  if (units <= dailyLimit / 2) return 1
  if (units <= dailyLimit) return 2
  if (units <= dailyLimit * 2) return 3
  return 4
}

export const LEVEL_LABEL: Record<Level, string> = {
  0: 'Dry',
  1: 'Light',
  2: 'Within limit',
  3: 'Over limit',
  4: 'Heavy',
}

// ---------- streaks ----------

export function isDrinkingDay(t: DayTotal | undefined): boolean {
  return !!t && t.drinks > 0
}

/** Consecutive dry days ending at (and including) today. 0 if today is a drinking day. */
export function currentDryStreak(byDay: Map<string, DayTotal>, today: string, firstDay: string | null): number {
  if (!firstDay) return 0
  let n = 0
  let k = today
  while (daysBetween(firstDay, k) >= 0 && !isDrinkingDay(byDay.get(k))) {
    n++
    k = addDays(k, -1)
  }
  return n
}

export function longestDryStreak(byDay: Map<string, DayTotal>, from: string, to: string): number {
  let best = 0
  let run = 0
  for (let k = from; daysBetween(k, to) >= 0; k = addDays(k, 1)) {
    if (isDrinkingDay(byDay.get(k))) run = 0
    else best = Math.max(best, ++run)
  }
  return best
}

// ---------- period summary ----------

export interface Summary {
  from: string
  to: string
  days: number
  drinkingDays: number
  dryDays: number
  units: number
  drinks: number
  water: number
  spend: number
  kcal: number
  avgPerDrinkingDay: number
  avgPerWeek: number
  overDays: number
  heaviest: { key: string; units: number } | null
  longestDry: number
  weeks: { start: string; units: number }[]
  weeksOverLimit: number
  byKind: { kind: DrinkKind; units: number; count: number }[]
  byWeekday: number[]
  byHour: number[]
  top: { name: string; emoji: string; count: number }[]
}

export function firstDay(entries: Entry[], dayStartHour: number): string | null {
  if (!entries.length) return null
  let min = Infinity
  for (const e of entries) if (e.ts < min) min = e.ts
  return dayKey(min, dayStartHour)
}

/**
 * Summarise [from, to] inclusive. `from` is clamped to the first logged day so
 * days before someone started tracking don't count as "dry".
 */
export function summarize(entries: Entry[], s: Settings, from: string, to: string): Summary {
  const first = firstDay(entries, s.dayStartHour)
  if (first && daysBetween(from, first) > 0) from = first
  const days = Math.max(0, daysBetween(from, to) + 1)

  const inRange = entries.filter((e) => {
    const k = dayKey(e.ts, s.dayStartHour)
    return k >= from && k <= to
  })
  const byDay = aggregateByDay(inRange, s)

  let units = 0, drinks = 0, water = 0, spend = 0, cal = 0, drinkingDays = 0, overDays = 0
  let heaviest: Summary['heaviest'] = null
  const weekdaySum = new Array(7).fill(0)
  const weekdayCount = new Array(7).fill(0)
  for (let k = from, i = 0; i < days; k = addDays(k, 1), i++) weekdayCount[weekdayIndex(k)]++

  for (const [k, t] of byDay) {
    units += t.units
    drinks += t.drinks
    water += t.water
    spend += t.spend
    cal += t.kcal
    weekdaySum[weekdayIndex(k)] += t.units
    if (t.drinks > 0) drinkingDays++
    if (t.units > s.dailyLimit) overDays++
    if (!heaviest || t.units > heaviest.units) heaviest = { key: k, units: t.units }
  }
  if (heaviest && heaviest.units === 0) heaviest = null

  const weekMap = new Map<string, number>()
  if (days > 0) for (let w = weekStart(from); w <= to; w = addDays(w, 7)) weekMap.set(w, 0)
  for (const [k, t] of byDay) {
    const w = weekStart(k)
    weekMap.set(w, (weekMap.get(w) ?? 0) + t.units)
  }
  const weeks = [...weekMap].map(([start, u]) => ({ start, units: u }))

  const kindMap = new Map<DrinkKind, { units: number; count: number }>()
  const hours = new Array(24).fill(0)
  const topMap = new Map<string, { name: string; emoji: string; count: number }>()
  for (const e of inRange) {
    if (e.kind === 'water') continue
    const km = kindMap.get(e.kind) ?? { units: 0, count: 0 }
    km.units += stdUnits(e, s.standard)
    km.count++
    kindMap.set(e.kind, km)
    hours[new Date(e.ts).getHours()]++
    const tk = `${e.emoji} ${e.name}`
    const tm = topMap.get(tk) ?? { name: e.name, emoji: e.emoji, count: 0 }
    tm.count++
    topMap.set(tk, tm)
  }

  return {
    from,
    to,
    days,
    drinkingDays,
    dryDays: days - drinkingDays,
    units,
    drinks,
    water,
    spend,
    kcal: cal,
    avgPerDrinkingDay: drinkingDays ? units / drinkingDays : 0,
    avgPerWeek: days ? (units / days) * 7 : 0,
    overDays,
    heaviest,
    longestDry: days ? longestDryStreak(byDay, from, to) : 0,
    weeks,
    weeksOverLimit: weeks.filter((w) => w.units > s.weeklyLimit).length,
    byKind: [...kindMap].map(([kind, v]) => ({ kind, ...v })).sort((a, b) => b.units - a.units),
    byWeekday: weekdaySum.map((sum, i) => (weekdayCount[i] ? sum / weekdayCount[i] : 0)),
    byHour: hours,
    top: [...topMap.values()].sort((a, b) => b.count - a.count).slice(0, 5),
  }
}
