import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import { collection, deleteDoc, doc, getDocs, onSnapshot, setDoc, writeBatch, type DocumentReference } from 'firebase/firestore'
import { useSyncExternalStore } from 'react'
import { auth, db } from './firebase'
import { KIND_LABEL, type AppData, type DrinkKind, type Entry, type Preset, type Settings } from './types'
import { defaultSettings } from './units'

/**
 * One store, two backends. Signed out, data lives in localStorage. Signed in,
 * Firestore is the source of truth: mutations apply locally at once, are
 * written to Firestore (which queues them offline), and snapshots flow back.
 * localStorage keeps a mirror either way so the app opens instantly.
 */

const KEY = 'pinttracker:v1'

export type SyncStatus = 'local' | 'synced' | 'pending' | 'offline'
export interface SyncState {
  /** undefined until Firebase Auth has restored the session */
  user: { uid: string; email: string | null; anonymous: boolean } | null | undefined
  status: SyncStatus
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return normalize(JSON.parse(raw))
  } catch {
    // fall through to a fresh store
  }
  return fresh()
}

function fresh(settings = defaultSettings()): AppData {
  return { version: 1, entries: [], settings }
}

/** Map drink types that no longer exist (e.g. cider) to "other". */
function fixKind<T extends { kind: DrinkKind }>(x: T): T {
  return x.kind in KIND_LABEL ? x : { ...x, kind: 'other' }
}

function normalize(d: Partial<AppData>): AppData {
  if (!d || !Array.isArray(d.entries)) throw new Error('Not a PintTracker backup')
  const settings = { ...defaultSettings(), ...(d.settings ?? {}) }
  return {
    version: 1,
    owner: d.owner,
    ownerAnonymous: d.ownerAnonymous,
    entries: d.entries
      .filter((e) => typeof e.ts === 'number' && typeof e.ml === 'number')
      .map(fixKind)
      .sort((a, b) => a.ts - b.ts),
    settings: { ...settings, presets: settings.presets.map(fixKind) },
  }
}

let data = load()
let sync: SyncState = { user: undefined, status: 'local' }
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function commit(next: AppData) {
  data = next
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // storage full / unavailable: keep in memory
  }
  emit()
}

function setSync(patch: Partial<SyncState>) {
  sync = { ...sync, ...patch }
  emit()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useData(): AppData {
  return useSyncExternalStore(subscribe, () => data)
}

export function useSync(): SyncState {
  return useSyncExternalStore(subscribe, () => sync)
}

export function getData(): AppData {
  return data
}

// ---------- Firestore plumbing ----------

/** uid when writes should go to the cloud */
function cloudUid(): string | null {
  const u = auth.currentUser
  return u && data.owner === u.uid ? u.uid : null
}
const userDoc = (uid: string) => doc(db, 'users', uid)
const entriesCol = (uid: string) => collection(db, 'users', uid, 'entries')
const entryDoc = (uid: string, id: string) => doc(db, 'users', uid, 'entries', id)

/**
 * Firestore batches cap at 500 operations. All batches are committed at once:
 * each applies to the local cache immediately, and the returned promise only
 * settles when the server acknowledges (which may be much later offline).
 */
function batched(ops: ((b: ReturnType<typeof writeBatch>) => void)[]): Promise<void> {
  const commits: Promise<void>[] = []
  for (let i = 0; i < ops.length; i += 450) {
    const b = writeBatch(db)
    ops.slice(i, i + 450).forEach((op) => op(b))
    commits.push(b.commit())
  }
  return Promise.all(commits).then(() => undefined)
}

function reportError(err: unknown) {
  console.error('[PintTracker sync]', err)
}

let settingsTimer: number | undefined
function pushSettings(uid: string) {
  // Settings inputs fire per keystroke; coalesce into one write.
  window.clearTimeout(settingsTimer)
  settingsTimer = window.setTimeout(() => {
    setDoc(userDoc(uid), { settings: data.settings }).catch(reportError)
  }, 600)
}

let unsubs: (() => void)[] = []
const pending = { entries: false, settings: false }
const offline = { entries: false, settings: false }
function refreshStatus() {
  if (!cloudUid()) return
  setSync({ status: pending.entries || pending.settings ? 'pending' : offline.entries && offline.settings ? 'offline' : 'synced' })
}

/**
 * Every device gets an invisible anonymous account so drinks are backed up
 * from the first one. Offline, we stay device-only and retry when online.
 */
function ensureAnonymous() {
  if (!auth.currentUser) signInAnonymously(auth).catch(() => {})
}
window.addEventListener('online', ensureAnonymous)

/** Re-read the current user after linking an email to an anonymous account (same uid). */
export function refreshUser() {
  const u = auth.currentUser
  if (!u) return
  setSync({ user: { uid: u.uid, email: u.email, anonymous: u.isAnonymous } })
  if (data.owner === u.uid) commit({ ...data, ownerAnonymous: u.isAnonymous })
}

onAuthStateChanged(auth, (user) => {
  unsubs.forEach((u) => u())
  unsubs = []

  if (!user) {
    if (data.owner && !data.ownerAnonymous) {
      // Signed out of a real account: its drinks stay in the cloud, not on this device.
      commit(fresh(data.settings))
    } else if (data.owner) {
      // Lost an anonymous session: keep the drinks as device-only so they carry into the next account.
      commit({ ...data, owner: undefined, ownerAnonymous: undefined })
    }
    setSync({ user: null, status: 'local' })
    ensureAnonymous()
    return
  }

  setSync({ user: { uid: user.uid, email: user.email, anonymous: user.isAnonymous }, status: 'pending' })
  const uid = user.uid

  if (data.owner !== uid) {
    // Device-only and anonymous drinks move into the account; another real account's mirror is dropped.
    const carry = !data.owner || data.ownerAnonymous ? data.entries : []
    commit({ ...data, owner: uid, ownerAnonymous: user.isAnonymous, entries: carry })
    batched(carry.map((e) => (b) => b.set(entryDoc(uid, e.id), e))).catch(reportError)
  }

  unsubs.push(
    onSnapshot(
      entriesCol(uid),
      { includeMetadataChanges: true },
      (snap) => {
        pending.entries = snap.metadata.hasPendingWrites
        offline.entries = snap.metadata.fromCache
        commit({ ...data, entries: snap.docs.map((d) => fixKind(d.data() as Entry)).sort((a, b) => a.ts - b.ts) })
        refreshStatus()
      },
      reportError,
    ),
    onSnapshot(
      userDoc(uid),
      { includeMetadataChanges: true },
      (snap) => {
        pending.settings = snap.metadata.hasPendingWrites
        offline.settings = snap.metadata.fromCache
        const remote = snap.data()?.settings as Partial<Settings> | undefined
        if (remote) {
          const settings = { ...defaultSettings(), ...remote }
          commit({ ...data, settings: { ...settings, presets: settings.presets.map(fixKind) } })
        } else if (!snap.metadata.fromCache) {
          // New account: adopt this device's settings.
          setDoc(userDoc(uid), { settings: data.settings }).catch(reportError)
        }
        refreshStatus()
      },
      reportError,
    ),
  )
})

// ---------- mutations ----------

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function entryFromPreset(p: Preset, ts = Date.now()): Entry {
  return { id: uid(), ts, name: p.name, emoji: p.emoji, kind: p.kind, ml: p.ml, abv: p.abv, price: p.price }
}

export function addEntry(e: Entry) {
  commit({ ...data, entries: [...data.entries, e].sort((a, b) => a.ts - b.ts) })
  const u = cloudUid()
  if (u) setDoc(entryDoc(u, e.id), e).catch(reportError)
}

export function updateEntry(e: Entry) {
  commit({ ...data, entries: data.entries.map((x) => (x.id === e.id ? e : x)).sort((a, b) => a.ts - b.ts) })
  const u = cloudUid()
  if (u) setDoc(entryDoc(u, e.id), e).catch(reportError)
}

export function deleteEntry(id: string) {
  commit({ ...data, entries: data.entries.filter((x) => x.id !== id) })
  const u = cloudUid()
  if (u) deleteDoc(entryDoc(u, id)).catch(reportError)
}

export function updateSettings(patch: Partial<Settings>) {
  commit({ ...data, settings: { ...data.settings, ...patch } })
  const u = cloudUid()
  if (u) pushSettings(u)
}

/** Replace everything with a backup. */
export async function importData(json: string) {
  const next = normalize(JSON.parse(json))
  const u = cloudUid()
  commit({ ...next, owner: data.owner })
  if (!u) return
  const existing = await getDocs(entriesCol(u))
  const keep = new Set(next.entries.map((e) => e.id))
  const refs: DocumentReference[] = existing.docs.filter((d) => !keep.has(d.id)).map((d) => d.ref)
  batched([
    ...refs.map((r) => (b: ReturnType<typeof writeBatch>) => b.delete(r)),
    ...next.entries.map((e) => (b: ReturnType<typeof writeBatch>) => b.set(entryDoc(u, e.id), e)),
    (b) => b.set(userDoc(u), { settings: next.settings }),
  ]).catch(reportError)
}

export async function wipe() {
  const u = cloudUid()
  commit({ ...data, entries: [] })
  if (!u) return
  const existing = await getDocs(entriesCol(u))
  batched(existing.docs.map((d) => (b) => b.delete(d.ref))).catch(reportError)
}

/** Load a few weeks of plausible history so the views can be explored. */
export function seedDemo() {
  const presets = data.settings.presets
  const entries: Entry[] = []
  const now = new Date()
  for (let d = 120; d >= 1; d--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d)
    const dow = day.getDay()
    const weekend = dow === 5 || dow === 6
    if (Math.random() > (weekend ? 0.85 : 0.3)) continue
    const count = weekend ? 2 + Math.floor(Math.random() * 6) : 1 + Math.floor(Math.random() * 2)
    for (let i = 0; i < count; i++) {
      const p = presets[Math.floor(Math.random() ** 1.6 * presets.length)]
      const ts = new Date(day).setHours(18 + Math.floor(i * 0.8), Math.floor(Math.random() * 60))
      entries.push({ ...entryFromPreset(p, ts), price: p.kind === 'shot' ? 120 : p.kind === 'cocktail' ? 450 : 220 })
    }
  }
  commit({ ...data, entries: [...data.entries, ...entries].sort((a, b) => a.ts - b.ts) })
  const u = cloudUid()
  if (u) batched(entries.map((e) => (b) => b.set(entryDoc(u, e.id), e))).catch(reportError)
}
