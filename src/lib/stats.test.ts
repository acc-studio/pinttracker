import { describe, expect, it } from 'vitest'
import {
  addDays,
  aggregateByDay,
  currentDryStreak,
  dayKey,
  level,
  longestDryStreak,
  summarize,
  weekStart,
} from './stats'
import type { Entry } from './types'
import { BEER_GRAMS, STANDARDS, defaultSettings, fmtGrams, gramsOfAlcohol, stdUnits, unitsToGrams } from './units'

const at = (y: number, m: number, d: number, h = 20, min = 0) => new Date(y, m - 1, d, h, min).getTime()
let n = 0
const pint = (ts: number, extra: Partial<Entry> = {}): Entry => ({
  id: `e${n++}`,
  ts,
  name: 'Pint',
  emoji: '🍺',
  kind: 'beer',
  ml: 568,
  abv: 4.5,
  ...extra,
})

describe('units', () => {
  it('computes grams of ethanol', () => {
    expect(gramsOfAlcohol(1000, 10)).toBeCloseTo(78.9)
  })
  it('a 500 ml 5% beer is exactly 1 Beer (~19.7 g)', () => {
    expect(BEER_GRAMS).toBeCloseTo(19.725, 3)
    expect(stdUnits({ ml: 500, abv: 5 }, 'beer')).toBe(1)
  })
  it('a 25 ml 40% shot is 0.4 Beers, a 35 ml single 0.56', () => {
    expect(stdUnits({ ml: 25, abv: 40 }, 'beer')).toBeCloseTo(0.4, 5)
    expect(stdUnits({ ml: 35, abv: 40 }, 'beer')).toBeCloseTo(0.56, 5)
  })
  it('defaults to the most generous UK/Ireland/US limits', () => {
    // daily: Ireland's 60 g per occasion; weekly: NIAAA's 196 g
    expect(STANDARDS.beer.daily).toBe(3)
    expect(STANDARDS.beer.weekly).toBe(9.9)
    expect(unitsToGrams(STANDARDS.beer.weekly, 'beer')).toBeCloseTo(195.3, 1)
    expect(defaultSettings()).toMatchObject({ standard: 'beer', dailyLimit: 3, weeklyLimit: 9.9 })
  })
  it('formats grams quietly', () => {
    expect(fmtGrams(59.4)).toBe('59 g')
    expect(fmtGrams(2400)).toBe('2.4 kg')
  })
})

describe('day keys', () => {
  it('counts after-midnight drinks toward the previous night', () => {
    expect(dayKey(at(2026, 3, 7, 1, 30), 5)).toBe('2026-03-06')
    expect(dayKey(at(2026, 3, 7, 5, 0), 5)).toBe('2026-03-07')
    expect(dayKey(at(2026, 3, 7, 1, 30), 0)).toBe('2026-03-07')
  })
  it('adds days across month and DST boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30')
    expect(addDays('2026-10-24', 3)).toBe('2026-10-27')
  })
  it('finds the Monday of a week', () => {
    expect(weekStart('2026-10-27')).toBe('2026-10-26') // Tue → Mon
    expect(weekStart('2026-11-01')).toBe('2026-10-26') // Sun → Mon
    expect(weekStart('2026-10-26')).toBe('2026-10-26')
  })
})

describe('levels', () => {
  it('buckets against the daily limit', () => {
    expect(level(0, 6)).toBe(0)
    expect(level(3, 6)).toBe(1)
    expect(level(6, 6)).toBe(2)
    expect(level(9, 6)).toBe(3)
    expect(level(13, 6)).toBe(4)
  })
})

describe('aggregation & streaks', () => {
  const s = defaultSettings()
  const entries = [
    pint(at(2026, 10, 1)),
    pint(at(2026, 10, 1, 23)),
    pint(at(2026, 10, 2, 0, 30)), // still Oct 1
    pint(at(2026, 10, 5)),
    { ...pint(at(2026, 10, 6)), kind: 'water' as const, abv: 0, name: 'Water' },
  ]
  const byDay = aggregateByDay(entries, s)

  it('aggregates by drinking day and ignores water for units', () => {
    expect(byDay.get('2026-10-01')?.drinks).toBe(3)
    expect(byDay.get('2026-10-02')).toBeUndefined()
    expect(byDay.get('2026-10-06')?.drinks).toBe(0)
    expect(byDay.get('2026-10-06')?.water).toBe(1)
  })
  it('computes dry streaks', () => {
    expect(longestDryStreak(byDay, '2026-10-01', '2026-10-10')).toBe(5) // 6th–10th
    expect(currentDryStreak(byDay, '2026-10-10', '2026-10-01')).toBe(5)
    expect(currentDryStreak(byDay, '2026-10-05', '2026-10-01')).toBe(0)
    expect(currentDryStreak(byDay, '2026-10-10', null)).toBe(0)
  })
})

describe('summarize', () => {
  const s = defaultSettings() // 3 Beers/day, 9.9/week; three 4.5% pints ≈ 3.07 Beers
  const entries = [
    pint(at(2026, 10, 5), { price: 6 }),
    pint(at(2026, 10, 5, 21), { price: 6 }),
    pint(at(2026, 10, 5, 22), { price: 6 }),
    pint(at(2026, 10, 9), { price: 6 }),
    pint(at(2026, 10, 14)),
  ]
  const sum = summarize(entries, s, '2026-09-01', '2026-10-18')

  it('clamps the range to the first logged day', () => {
    expect(sum.from).toBe('2026-10-05')
    expect(sum.days).toBe(14)
  })
  it('counts drinking and dry days', () => {
    expect(sum.drinkingDays).toBe(3)
    expect(sum.dryDays).toBe(11)
    expect(sum.drinks).toBe(5)
    expect(sum.spend).toBe(24)
  })
  it('flags over-limit days and weeks', () => {
    expect(sum.overDays).toBe(1)
    expect(sum.heaviest?.key).toBe('2026-10-05')
    expect(sum.weeks.map((w) => w.start)).toEqual(['2026-10-05', '2026-10-12'])
    expect(sum.weeksOverLimit).toBe(0)
  })
  it('breaks down by weekday and hour', () => {
    expect(sum.byWeekday[0]).toBeGreaterThan(0) // Mondays
    expect(sum.byHour[20]).toBe(3)
    expect(sum.top[0]).toMatchObject({ name: 'Pint', count: 5 })
  })
})
