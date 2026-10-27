import { useState } from 'react'
import { addEntry, deleteEntry, getData, uid, updateEntry, updateSettings } from '../lib/store'
import { fromLocalInput, toLocalInput } from '../lib/format'
import { KIND_LABEL, type DrinkKind, type Entry } from '../lib/types'
import { STANDARDS, fmtGrams, fmtUnits, gramsOfAlcohol, stdUnits } from '../lib/units'
import { Sheet } from './Sheet'

const SIZES = [25, 35, 50, 70, 125, 175, 250, 330, 500]
const KIND_EMOJI: Record<DrinkKind, string> = {
  beer: '🍺', wine: '🍷', cocktail: '🍸', shot: '🔥', spirit: '🥃', other: '🥤', water: '💧',
}

export function EntryEditor({ initial, isNew, onClose }: { initial: Entry; isNew: boolean; onClose: (msg?: string) => void }) {
  const [e, setE] = useState<Entry>(initial)
  const [asPreset, setAsPreset] = useState(false)
  const { settings } = getData()
  const set = <K extends keyof Entry>(k: K, v: Entry[K]) => setE((p) => ({ ...p, [k]: v }))
  const valid = e.name.trim() && e.ml > 0 && e.abv >= 0 && e.abv <= 100 && !Number.isNaN(e.ts)

  function save() {
    if (!valid) return
    const clean = { ...e, name: e.name.trim(), price: e.price || undefined, note: e.note?.trim() || undefined }
    if (isNew) addEntry(clean)
    else updateEntry(clean)
    if (asPreset) {
      const { id: _id, ts: _ts, note: _note, ...rest } = clean
      updateSettings({ presets: [...settings.presets, { ...rest, id: uid() }] })
    }
    onClose(isNew ? `Logged ${clean.emoji} ${clean.name}` : 'Saved')
  }

  return (
    <Sheet title={isNew ? 'Log a drink' : 'Edit drink'} onClose={() => onClose()}>
      <div className="form">
        <div className="row">
          <label className="field emoji-field">
            <span>Icon</span>
            <input value={e.emoji} onChange={(x) => set('emoji', x.target.value)} maxLength={4} />
          </label>
          <label className="field grow">
            <span>Name</span>
            <input value={e.name} onChange={(x) => set('name', x.target.value)} placeholder="e.g. Negroni" />
          </label>
        </div>

        <div className="field">
          <span>Type</span>
          <div className="chips">
            {(Object.keys(KIND_LABEL) as DrinkKind[]).map((k) => (
              <button
                key={k}
                type="button"
                className={`chip${e.kind === k ? ' on' : ''}`}
                onClick={() => setE((p) => ({ ...p, kind: k, abv: k === 'water' ? 0 : p.abv, emoji: p.emoji || KIND_EMOJI[k] }))}
              >
                {KIND_EMOJI[k]} {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>Size (ml)</span>
          <div className="chips">
            {SIZES.map((s) => (
              <button key={s} type="button" className={`chip${e.ml === s ? ' on' : ''}`} onClick={() => set('ml', s)}>
                {s}
              </button>
            ))}
          </div>
          <input type="number" inputMode="decimal" min={1} value={e.ml || ''} onChange={(x) => set('ml', Number(x.target.value))} />
        </div>

        <div className="row">
          <label className="field grow">
            <span>ABV %</span>
            <input type="number" inputMode="decimal" min={0} max={100} step={0.1} value={e.abv} onChange={(x) => set('abv', Number(x.target.value))} />
          </label>
          <label className="field grow">
            <span>Price ({settings.currency})</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.1}
              value={e.price ?? ''}
              onChange={(x) => set('price', x.target.value === '' ? undefined : Number(x.target.value))}
              placeholder="optional"
            />
          </label>
        </div>

        <label className="field">
          <span>When</span>
          <input type="datetime-local" value={toLocalInput(e.ts)} onChange={(x) => x.target.value && set('ts', fromLocalInput(x.target.value))} />
        </label>

        <label className="field">
          <span>Note</span>
          <input value={e.note ?? ''} onChange={(x) => set('note', x.target.value)} placeholder="where, who with…" />
        </label>

        {isNew && (
          <label className="check">
            <input type="checkbox" checked={asPreset} onChange={(x) => setAsPreset(x.target.checked)} />
            Also add as a quick-log button
          </label>
        )}

        <p className="muted small">
          = <strong>{fmtUnits(stdUnits(e, settings.standard))}</strong> {STANDARDS[settings.standard].short}
          <span className="grams"> · {fmtGrams(gramsOfAlcohol(e.ml, e.abv))} alcohol</span>
        </p>

        <div className="actions">
          {!isNew && (
            <button
              className="btn danger"
              onClick={() => {
                deleteEntry(e.id)
                onClose('Deleted')
              }}
            >
              Delete
            </button>
          )}
          <button className="btn primary grow" disabled={!valid} onClick={save}>
            {isNew ? 'Log it' : 'Save'}
          </button>
        </div>
      </div>
    </Sheet>
  )
}
