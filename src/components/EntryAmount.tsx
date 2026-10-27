import type { Entry, UnitStandard } from '../lib/types'
import { fmtGrams, fmtUnits, gramsOfAlcohol, stdUnits } from '../lib/units'

/** Right-hand amount on a drink row: Beers up front, grams of alcohol underneath. */
export function EntryAmount({ e, standard }: { e: Entry; standard: UnitStandard }) {
  if (e.kind === 'water') return <span className="entry-units" />
  return (
    <span className="entry-units">
      {fmtUnits(stdUnits(e, standard))}
      <span className="grams">{fmtGrams(gramsOfAlcohol(e.ml, e.abv))}</span>
    </span>
  )
}
