import { App as CapApp } from '@capacitor/app'
import { useCallback, useEffect, useRef, useState } from 'react'
import { DaySheet } from './components/DaySheet'
import { EntryEditor } from './components/EntryEditor'
import { UpdateBanner } from './components/UpdateBanner'
import { startUpdateChecks } from './lib/updater'
import { isNative, tap } from './lib/native'
import { addEntry, deleteEntry, entryFromPreset, uid, useData } from './lib/store'
import type { Entry, Preset } from './lib/types'
import { CalendarView } from './views/CalendarView'
import { LogView } from './views/LogView'
import { SettingsView } from './views/SettingsView'
import { StatsView } from './views/StatsView'

type Tab = 'log' | 'calendar' | 'stats' | 'settings'
type Overlay = { type: 'day'; key: string } | { type: 'entry'; entry: Entry; isNew: boolean } | null
interface Toast {
  id: number
  msg: string
  undo?: () => void
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'log', label: 'Log', icon: '🍺' },
  { id: 'calendar', label: 'Calendar', icon: '📅' },
  { id: 'stats', label: 'Stats', icon: '📊' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

function useNow(ms: number) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    const wake = () => document.visibilityState === 'visible' && setNow(Date.now())
    document.addEventListener('visibilitychange', wake)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', wake)
    }
  }, [ms])
  return now
}

export default function App() {
  const { settings } = useData()
  const [tab, setTab] = useState<Tab>('log')
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [dayUnder, setDayUnder] = useState<string | null>(null) // day sheet to return to after editing
  const [toast, setToast] = useState<Toast | null>(null)
  const now = useNow(30_000)
  const toastTimer = useRef<number | undefined>(undefined)

  const showToast = useCallback((msg: string, undo?: () => void) => {
    window.clearTimeout(toastTimer.current)
    setToast({ id: Date.now(), msg, undo })
    toastTimer.current = window.setTimeout(() => setToast(null), undo ? 5000 : 2500)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  useEffect(startUpdateChecks, [])

  // Android hardware back: close sheet → go to Log tab → exit.
  const backState = useRef({ overlay, tab, dayUnder })
  useEffect(() => {
    backState.current = { overlay, tab, dayUnder }
  }, [overlay, tab, dayUnder])
  useEffect(() => {
    if (!isNative) return
    const h = CapApp.addListener('backButton', () => {
      const s = backState.current
      if (s.overlay?.type === 'entry' && s.dayUnder) setOverlay({ type: 'day', key: s.dayUnder })
      else if (s.overlay) {
        setOverlay(null)
        setDayUnder(null)
      } else if (s.tab !== 'log') setTab('log')
      else CapApp.exitApp()
    })
    return () => {
      h.then((x) => x.remove())
    }
  }, [])

  const quickLog = (p: Preset) => {
    const e = entryFromPreset(p)
    addEntry(e)
    tap(true)
    showToast(`${p.emoji} ${p.name} logged`, () => deleteEntry(e.id))
  }

  const openEditor = (entry: Entry, isNew: boolean) => setOverlay({ type: 'entry', entry, isNew })
  const closeEditor = (msg?: string) => {
    if (msg) showToast(msg)
    setOverlay(dayUnder ? { type: 'day', key: dayUnder } : null)
  }
  const openDay = (key: string) => {
    setDayUnder(key)
    setOverlay({ type: 'day', key })
  }
  const blank = (ts = Date.now()): Entry => ({ id: uid(), ts, name: '', emoji: '🍹', kind: 'cocktail', ml: 200, abv: 12 })

  return (
    <div className="app">
      <main>
        <UpdateBanner />
        {tab === 'log' && (
          <LogView
            now={now}
            onQuickLog={quickLog}
            onCustom={(p) => {
              setDayUnder(null)
              openEditor(p ? entryFromPreset(p) : blank(), true)
            }}
            onEdit={(e) => {
              setDayUnder(null)
              openEditor(e, false)
            }}
            onDeleted={(e) => showToast(`Removed ${e.name}`, () => addEntry(e))}
            onOpenSettings={() => setTab('settings')}
          />
        )}
        {tab === 'calendar' && <CalendarView now={now} onDay={openDay} />}
        {tab === 'stats' && <StatsView now={now} onDay={openDay} />}
        {tab === 'settings' && <SettingsView toast={showToast} />}
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
            <span className="tab-icon" aria-hidden="true">
              {t.icon}
            </span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {overlay?.type === 'day' && (
        <DaySheet
          dayKey={overlay.key}
          onClose={() => {
            setOverlay(null)
            setDayUnder(null)
          }}
          onEdit={(e) => openEditor(e, false)}
          onAdd={(ts) => openEditor(blank(ts), true)}
        />
      )}
      {overlay?.type === 'entry' && <EntryEditor key={overlay.entry.id} initial={overlay.entry} isNew={overlay.isNew} onClose={closeEditor} />}

      {toast && (
        <div className="toast" key={toast.id} role="status">
          <span>{toast.msg}</span>
          {toast.undo && (
            <button
              onClick={() => {
                toast.undo!()
                setToast(null)
                tap()
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  )
}
