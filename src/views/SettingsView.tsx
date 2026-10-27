import { useRef, useState } from 'react'
import { AccountCard } from '../components/AccountCard'
import { fmtHour } from '../lib/format'
import { isNative, saveFile } from '../lib/native'
import { checkForUpdate } from '../lib/updater'
import { getData, importData, seedDemo, uid, updateSettings, useData, useSync, wipe } from '../lib/store'
import { KIND_LABEL, type DrinkKind, type Preset } from '../lib/types'
import { BEER_GRAMS, DEFAULT_PRESETS, gramsOfAlcohol, STANDARDS, fmtGrams, fmtUnits, stdUnits, unitsToGrams } from '../lib/units'

export function SettingsView({ toast }: { toast: (msg: string) => void }) {
  const { settings, entries } = useData()
  const { user } = useSync()
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)

  const setPreset = (id: string, patch: Partial<Preset>) =>
    updateSettings({ presets: settings.presets.map((p) => (p.id === id ? { ...p, ...patch } : p)) })
  const movePreset = (i: number, d: number) => {
    const ps = [...settings.presets]
    const j = i + d
    if (j < 0 || j >= ps.length) return
    ;[ps[i], ps[j]] = [ps[j], ps[i]]
    updateSettings({ presets: ps })
  }

  async function exportJson() {
    const { owner: _owner, ...backup } = getData()
    await saveFile(`pinttracker-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), 'application/json')
  }
  async function exportCsv() {
    const rows = [['date', 'time', 'name', 'type', 'ml', 'abv', `${STANDARDS[settings.standard].short}`, 'grams_alcohol', 'price', 'note']]
    for (const e of entries) {
      const d = new Date(e.ts)
      rows.push([
        d.toLocaleDateString('en-CA'),
        d.toTimeString().slice(0, 5),
        e.name,
        e.kind,
        `${e.ml}`,
        `${e.abv}`,
        stdUnits(e, settings.standard).toFixed(2),
        gramsOfAlcohol(e.ml, e.abv).toFixed(1),
        e.price != null ? `${e.price}` : '',
        e.note ?? '',
      ])
    }
    const csv = rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n')
    await saveFile(`pinttracker-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv')
  }
  async function onImport(f: File | undefined) {
    if (!f) return
    try {
      await importData(await f.text())
      toast('Backup restored')
    } catch (err) {
      toast(`Import failed: ${(err as Error).message}`)
    }
  }

  return (
    <div className="view settings">
      <AccountCard toast={toast} />
      <section className="card form">
        <h3 className="section-title">Measuring</h3>
        <p className="muted small">
          Everything is counted in <strong>Beers</strong>: the alcohol in one 500 ml beer at 5% (≈{fmtGrams(BEER_GRAMS)}). A single spirit is about
          0.6, a glass of wine about 0.9.
        </p>
        <div className="row">
          <label className="field grow">
            <span>Daily limit (Beers)</span>
            <input type="number" inputMode="decimal" min={0.5} step={0.1} value={settings.dailyLimit} onChange={(e) => updateSettings({ dailyLimit: Number(e.target.value) || 0.5 })} />
            <span className="field-hint">≈ {fmtGrams(unitsToGrams(settings.dailyLimit, settings.standard))} alcohol</span>
          </label>
          <label className="field grow">
            <span>Weekly limit (Beers)</span>
            <input type="number" inputMode="decimal" min={0.5} step={0.1} value={settings.weeklyLimit} onChange={(e) => updateSettings({ weeklyLimit: Number(e.target.value) || 0.5 })} />
            <span className="field-hint">≈ {fmtGrams(unitsToGrams(settings.weeklyLimit, settings.standard))} alcohol</span>
          </label>
        </div>
        <p className="muted small">
          Defaults are the most generous official guidance: Ireland's 6 standard drinks (60 g) on any one occasion and the US NIAAA's 14 drinks
          (196 g) a week. The UK's is lower, at 14 units (112 g) a week.{' '}
          {(settings.dailyLimit !== STANDARDS.beer.daily || settings.weeklyLimit !== STANDARDS.beer.weekly) && (
            <button type="button" className="link-btn inline" onClick={() => updateSettings({ dailyLimit: STANDARDS.beer.daily, weeklyLimit: STANDARDS.beer.weekly })}>
              Reset to defaults
            </button>
          )}
        </p>
        <div className="row">
          <label className="field grow">
            <span>New day starts at</span>
            <select value={settings.dayStartHour} onChange={(e) => updateSettings({ dayStartHour: Number(e.target.value) })}>
              {Array.from({ length: 9 }, (_, h) => (
                <option key={h} value={h}>
                  {fmtHour(h)}
                </option>
              ))}
            </select>
          </label>
          <label className="field grow">
            <span>Currency</span>
            <input value={settings.currency} maxLength={3} onChange={(e) => updateSettings({ currency: e.target.value.toUpperCase() })} />
          </label>
        </div>
        <p className="muted small">Drinks after midnight count toward the night before, until the new day starts.</p>
        <label className="field">
          <span>Theme</span>
          <select value={settings.theme} onChange={(e) => updateSettings({ theme: e.target.value as typeof settings.theme })}>
            <option value="system">Match device</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
      </section>

      <section className="card">
        <h3 className="section-title">Quick-log buttons</h3>
        <ul className="preset-edit-list">
          {settings.presets.map((p, i) => (
            <li key={p.id} className="preset-edit">
              <div className="row">
                <input className="emoji-in" value={p.emoji} maxLength={4} onChange={(e) => setPreset(p.id, { emoji: e.target.value })} aria-label="Icon" />
                <input className="grow" value={p.name} onChange={(e) => setPreset(p.id, { name: e.target.value })} aria-label="Name" />
                <button className="icon-btn" onClick={() => movePreset(i, -1)} aria-label="Move up" disabled={i === 0}>
                  ↑
                </button>
                <button className="icon-btn" onClick={() => movePreset(i, 1)} aria-label="Move down" disabled={i === settings.presets.length - 1}>
                  ↓
                </button>
                <button className="icon-btn" onClick={() => updateSettings({ presets: settings.presets.filter((x) => x.id !== p.id) })} aria-label={`Remove ${p.name}`}>
                  ✕
                </button>
              </div>
              <div className="row small-fields">
                <select value={p.kind} onChange={(e) => setPreset(p.id, { kind: e.target.value as DrinkKind })} aria-label="Type">
                  {(Object.keys(KIND_LABEL) as DrinkKind[]).filter((k) => k !== 'water').map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
                <label>
                  <input type="number" inputMode="decimal" value={p.ml} onChange={(e) => setPreset(p.id, { ml: Number(e.target.value) })} />
                  ml
                </label>
                <label>
                  <input type="number" inputMode="decimal" step={0.1} value={p.abv} onChange={(e) => setPreset(p.id, { abv: Number(e.target.value) })} />%
                </label>
                <label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step={0.1}
                    value={p.price ?? ''}
                    placeholder="price"
                    onChange={(e) => setPreset(p.id, { price: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </label>
                <span className="muted">{fmtUnits(stdUnits(p, settings.standard))} beers</span>
              </div>
            </li>
          ))}
        </ul>
        <div className="actions">
          <button
            className="btn ghost grow"
            onClick={() => updateSettings({ presets: [...settings.presets, { id: uid(), name: 'New drink', emoji: '🍹', kind: 'cocktail', ml: 200, abv: 12 }] })}
          >
            ＋ Add button
          </button>
          <button className="btn ghost" onClick={() => updateSettings({ presets: DEFAULT_PRESETS.map((p) => ({ ...p })) })}>
            Reset
          </button>
        </div>
      </section>

      <section className="card">
        <h3 className="section-title">Your data</h3>
        <p className="muted small">
          {entries.length} drinks{' '}
          {user && !user.anonymous
            ? 'synced to your account.'
            : user
              ? 'backed up anonymously. Create an account above to reach them from other devices.'
              : 'stored on this device only. Sign in above to back them up and sync.'}
        </p>
        <div className="btn-stack">
          <button className="btn ghost" onClick={exportJson}>
            Back up (JSON)
          </button>
          <button className="btn ghost" onClick={exportCsv}>
            Export spreadsheet (CSV)
          </button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>
            Restore from backup…
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onImport(e.target.files?.[0])} />
          {entries.length === 0 && (
            <button className="btn ghost" onClick={() => (seedDemo(), toast('Demo data loaded'))}>
              Load demo data to explore
            </button>
          )}
          <button
            className={`btn ${confirmWipe ? 'danger' : 'ghost'}`}
            onBlur={() => setConfirmWipe(false)}
            onClick={() => {
              if (!confirmWipe) return setConfirmWipe(true)
              wipe().catch(() => toast('Could not erase cloud data'))
              setConfirmWipe(false)
              toast('All drinks erased')
            }}
          >
            {confirmWipe ? 'Tap again to erase everything' : 'Erase all drinks'}
          </button>
        </div>
      </section>
      {isNative && (
        <button
          className="btn ghost"
          onClick={async () => {
            const r = await checkForUpdate(true)
            if (!r) toast('You have the latest version')
          }}
        >
          Check for updates
        </button>
      )}
      <p className="muted small center pad">PintTracker {__APP_VERSION__} · estimates only, not medical advice.</p>
    </div>
  )
}
