import { App } from '@capacitor/app'
import { FileTransfer } from '@capacitor/file-transfer'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { FileOpener } from '@capawesome-team/capacitor-file-opener'
import { useSyncExternalStore } from 'react'
import { isNative } from './native'

/**
 * Android self-update. Each release publishes android/latest.json next to the
 * web app; when its versionCode beats the installed one we offer the APK and
 * hand it to the system installer. Every release is signed with the same key,
 * so Android installs it over the top and keeps the user's data.
 */

const MANIFEST_URL = 'https://pint-tracker.web.app/android/latest.json'
const CHECK_EVERY = 6 * 3_600_000
const SKIP_KEY = 'pinttracker:skip-version'

export interface Release {
  versionCode: number
  versionName: string
  url: string
  notes?: string
}

export type UpdateState =
  | { phase: 'idle' }
  | { phase: 'available'; release: Release }
  | { phase: 'downloading'; release: Release; progress: number }
  | { phase: 'error'; release: Release; message: string }

let state: UpdateState = { phase: 'idle' }
let lastCheck = 0
const listeners = new Set<() => void>()
function set(next: UpdateState) {
  state = next
  listeners.forEach((l) => l())
}

export function useUpdate(): UpdateState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export async function checkForUpdate(force = false): Promise<Release | null> {
  if (!isNative || state.phase === 'downloading') return null
  if (!force && Date.now() - lastCheck < CHECK_EVERY) return null
  lastCheck = Date.now()
  try {
    const [info, res] = await Promise.all([App.getInfo(), fetch(`${MANIFEST_URL}?t=${Date.now()}`, { cache: 'no-store' })])
    if (!res.ok) return null
    const release = (await res.json()) as Release
    const installed = Number(info.build)
    if (!(release.versionCode > installed)) return null
    if (!force && localStorage.getItem(SKIP_KEY) === String(release.versionCode)) return null
    set({ phase: 'available', release })
    return release
  } catch {
    return null // offline or manifest missing: try again later
  }
}

export function dismissUpdate() {
  if (state.phase === 'available' || state.phase === 'error') {
    try {
      localStorage.setItem(SKIP_KEY, String(state.release.versionCode))
    } catch {
      // ignore
    }
  }
  set({ phase: 'idle' })
}

export async function installUpdate() {
  if (state.phase !== 'available' && state.phase !== 'error') return
  const release = state.release
  set({ phase: 'downloading', release, progress: 0 })
  const progress = await FileTransfer.addListener('progress', (p) => {
    if (p.contentLength > 0) set({ phase: 'downloading', release, progress: p.bytes / p.contentLength })
  })
  try {
    const { uri } = await Filesystem.getUri({ directory: Directory.Cache, path: `PintTracker-${release.versionName}.apk` })
    const { path } = await FileTransfer.downloadFile({ url: release.url, path: uri, progress: true })
    // Opens Android's installer. The first time, Android asks to allow installs from PintTracker.
    await FileOpener.openFile({ path: path ?? uri, mimeType: 'application/vnd.android.package-archive' })
    set({ phase: 'available', release })
  } catch (err) {
    set({ phase: 'error', release, message: (err as Error)?.message ?? 'Download failed' })
  } finally {
    progress.remove()
  }
}

export function startUpdateChecks() {
  if (!isNative) return
  checkForUpdate()
  App.addListener('resume', () => checkForUpdate())
}
