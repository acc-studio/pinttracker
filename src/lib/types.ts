export type DrinkKind = 'beer' | 'wine' | 'cocktail' | 'shot' | 'spirit' | 'other' | 'water'

export interface Preset {
  id: string
  name: string
  emoji: string
  kind: DrinkKind
  ml: number
  abv: number
  price?: number
}

export interface Entry {
  id: string
  /** epoch ms */
  ts: number
  name: string
  emoji: string
  kind: DrinkKind
  ml: number
  abv: number
  price?: number
  note?: string
}

/** How a "standard drink" is defined: grams of pure alcohol per unit. */
export type UnitStandard = 'uk' | 'us' | 'au'

export interface Settings {
  standard: UnitStandard
  /** standard units per day above which a day counts as "over" */
  dailyLimit: number
  /** standard units per week */
  weeklyLimit: number
  /** drinks before this local hour count toward the previous day */
  dayStartHour: number
  currency: string
  presets: Preset[]
  theme: 'system' | 'dark' | 'light'
}

export interface AppData {
  version: 1
  /** uid of the signed-in account this data mirrors; absent for guest (device-only) data */
  owner?: string
  /** owner is an anonymous account: its drinks carry over when signing into a real one */
  ownerAnonymous?: boolean
  entries: Entry[]
  settings: Settings
}

export const KIND_LABEL: Record<DrinkKind, string> = {
  beer: 'Beer',
  wine: 'Wine',
  cocktail: 'Cocktail',
  shot: 'Shot',
  spirit: 'Spirit',
  other: 'Other',
  water: 'Water',
}
