import type { DrinkKind, Entry, Preset, Settings, UnitStandard } from './types'

const ETHANOL_DENSITY = 0.789

export function gramsOfAlcohol(ml: number, abv: number): number {
  return ml * (abv / 100) * ETHANOL_DENSITY
}

/** One "Beer": the alcohol in a 500 ml beer at 5% ABV (≈ 19.7 g). */
export const BEER_GRAMS = gramsOfAlcohol(500, 5)

export const STANDARDS: Record<UnitStandard, { label: string; short: string; grams: number; daily: number; weekly: number }> = {
  beer: {
    label: 'Beers (500 ml at 5%)',
    short: 'beers',
    grams: BEER_GRAMS,
    daily: 3,
    weekly: 10,
  },
}

export function unitsToGrams(units: number, standard: UnitStandard): number {
  return units * STANDARDS[standard].grams
}

/** Secondary, low-key display of pure alcohol: "59 g", "2.4 kg". */
export function fmtGrams(g: number): string {
  if (g >= 10_000) return `${Math.round(g / 1000)} kg`
  if (g >= 1000) return `${(g / 1000).toFixed(1)} kg`
  return `${Math.round(g)} g`
}

export function stdUnits(e: Pick<Entry, 'ml' | 'abv'>, standard: UnitStandard): number {
  return gramsOfAlcohol(e.ml, e.abv) / STANDARDS[standard].grams
}

/** Non-alcohol kcal per ml, a rough average per kind (sugars, carbs, mixers). */
const EXTRA_KCAL_PER_ML: Record<DrinkKind, number> = {
  beer: 0.12,
  wine: 0.15,
  cocktail: 0.6,
  shot: 0,
  spirit: 0,
  other: 0.1,
  water: 0,
}

export function kcal(e: Pick<Entry, 'ml' | 'abv' | 'kind'>): number {
  return gramsOfAlcohol(e.ml, e.abv) * 7 + e.ml * EXTRA_KCAL_PER_ML[e.kind]
}

export function fmtUnits(n: number): string {
  if (n === 0) return '0'
  if (n < 10) return n.toFixed(1)
  return Math.round(n).toString()
}

export function fmtMoney(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: n >= 100 ? 0 : 2 }).format(n)
  } catch {
    return `${currency} ${n.toFixed(2)}`
  }
}

export const DEFAULT_PRESETS: Preset[] = [
  { id: 'beer-large', name: 'Large beer', emoji: '🍺', kind: 'beer', ml: 500, abv: 5 },
  { id: 'beer-small', name: 'Small beer', emoji: '🥫', kind: 'beer', ml: 330, abv: 5 },
  { id: 'wine', name: 'Glass of wine', emoji: '🍷', kind: 'wine', ml: 175, abv: 12.5 },
  { id: 'cocktail', name: 'Cocktail', emoji: '🍸', kind: 'cocktail', ml: 200, abv: 15 },
  { id: 'single', name: 'Single spirit', emoji: '🥃', kind: 'spirit', ml: 35, abv: 40 },
  { id: 'double', name: 'Double spirit', emoji: '🥃', kind: 'spirit', ml: 70, abv: 40 },
  { id: 'shot', name: 'Shot', emoji: '🔥', kind: 'shot', ml: 25, abv: 40 },
  { id: 'prosecco', name: 'Fizz', emoji: '🥂', kind: 'wine', ml: 125, abv: 11 },
]

/** Ids of default buttons that have since been retired; dropped from saved settings on load. */
export const RETIRED_PRESETS = new Set(['pint', 'half'])

export const WATER: Preset = { id: 'water', name: 'Water', emoji: '💧', kind: 'water', ml: 330, abv: 0 }

function localCurrency(): string {
  const lang = typeof navigator === 'undefined' ? '' : navigator.language
  if (lang.startsWith('tr')) return 'TRY'
  if (lang === 'en-US') return 'USD'
  if (/^(de|fr|es|it|nl|pt-PT)/.test(lang)) return 'EUR'
  return 'GBP'
}

export function defaultSettings(): Settings {
  return {
    standard: 'beer',
    dailyLimit: STANDARDS.beer.daily,
    weeklyLimit: STANDARDS.beer.weekly,
    dayStartHour: 5,
    currency: localCurrency(),
    presets: DEFAULT_PRESETS.map((p) => ({ ...p })),
    theme: 'system',
  }
}
