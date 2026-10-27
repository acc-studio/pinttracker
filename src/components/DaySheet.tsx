import { fmtDay, fmtTime } from '../lib/format'
import { LEVEL_LABEL, aggregateByDay, dayKey, level, parseKey } from '../lib/stats'
import { useData } from '../lib/store'
import type { Entry } from '../lib/types'
import { STANDARDS, fmtGrams, fmtMoney, fmtUnits, unitsToGrams } from '../lib/units'
import { EntryAmount } from './EntryAmount'
import { Sheet } from './Sheet'

export function DaySheet({ dayKey: key, onClose, onEdit, onAdd }: { dayKey: string; onClose: () => void; onEdit: (e: Entry) => void; onAdd: (ts: number) => void }) {
  const { entries, settings } = useData()
  const list = entries.filter((e) => dayKey(e.ts, settings.dayStartHour) === key)
  const t = aggregateByDay(list, settings).get(key)
  const units = t?.units ?? 0
  const lv = level(units, settings.dailyLimit)
  const unit = STANDARDS[settings.standard].short

  // Default new entries on a past day to 9pm that evening.
  const addTs = () => {
    const d = parseKey(key)
    d.setHours(21, 0, 0, 0)
    return Math.min(d.getTime(), Date.now())
  }

  return (
    <Sheet title={fmtDay(key)} onClose={onClose}>
      <div className="day-summary">
        <span className={`dot lv${lv}`} />
        <span>
          <strong>{fmtUnits(units)}</strong> {unit} · {t?.drinks ?? 0} drinks · {LEVEL_LABEL[lv]}
          {units > 0 && <span className="grams"> · {fmtGrams(unitsToGrams(units, settings.standard))}</span>}
          {t && t.spend > 0 && <> · {fmtMoney(t.spend, settings.currency)}</>}
        </span>
      </div>
      {list.length === 0 ? (
        <p className="muted center pad">Nothing logged. A dry day. 🌿</p>
      ) : (
        <ul className="entry-list">
          {list.map((e) => (
            <li key={e.id}>
              <button className="entry" onClick={() => onEdit(e)}>
                <span className="entry-emoji">{e.emoji}</span>
                <span className="entry-main">
                  <span>{e.name}</span>
                  <span className="muted small">
                    {fmtTime(e.ts)} · {e.ml} ml · {e.abv}%{e.note ? ` · ${e.note}` : ''}
                  </span>
                </span>
                <EntryAmount e={e} standard={settings.standard} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className="btn ghost full" onClick={() => onAdd(addTs())}>
        ＋ Add a drink to this day
      </button>
    </Sheet>
  )
}
