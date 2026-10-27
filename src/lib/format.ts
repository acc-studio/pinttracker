import { parseKey } from './stats'

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function fmtDay(key: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }): string {
  return parseKey(key).toLocaleDateString(undefined, opts)
}

export function fmtShortDay(key: string): string {
  return fmtDay(key, { day: 'numeric', month: 'short' })
}

export function fmtAgo(ms: number): string {
  const m = Math.round(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m ago`
}

export function fmtHour(h: number): string {
  return new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' })
}

/** value for <input type="datetime-local"> */
export function toLocalInput(ts: number): string {
  const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 16)
}

export function fromLocalInput(v: string): number {
  return new Date(v).getTime()
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
