import { useState } from 'react'

export interface Bar {
  label: string
  /** shown in the readout when the bar is tapped */
  detail: string
  value: number
  hot?: boolean
}

/**
 * Vertical bar chart built from divs: touch friendly, tap a bar to read it.
 * `axisEvery` thins the x labels on dense charts.
 */
export function BarChart({
  bars,
  refLine,
  refLabel,
  axisEvery = 1,
  height = 140,
  empty = 'Nothing logged in this period',
}: {
  bars: Bar[]
  refLine?: number
  refLabel?: string
  axisEvery?: number
  height?: number
  empty?: string
}) {
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(...bars.map((b) => b.value), refLine ?? 0) || 1
  const total = bars.reduce((a, b) => a + b.value, 0)
  const sel = active != null ? bars[active] : null

  return (
    <div className="chart">
      <div className="chart-readout" aria-live="polite">
        {sel ? sel.detail : total === 0 ? empty : 'Tap a bar for details'}
      </div>
      <div className="bars" style={{ height }} onMouseLeave={() => setActive(null)}>
        {refLine != null && refLine > 0 && (
          <div className="ref-line" style={{ bottom: `${(refLine / max) * 100}%` }}>
            {refLabel && <span>{refLabel}</span>}
          </div>
        )}
        {bars.map((b, i) => (
          <button
            key={i}
            className={`bar-hit${active === i ? ' active' : ''}`}
            onClick={() => setActive(active === i ? null : i)}
            onMouseEnter={() => setActive(i)}
            aria-label={b.detail}
          >
            <span className={`bar${b.hot ? ' hot' : ''}`} style={{ height: `${(b.value / max) * 100}%` }} />
          </button>
        ))}
      </div>
      <div className="bar-axis">
        {bars.map((b, i) => (
          <span key={i}>{i % axisEvery === 0 ? b.label : ''}</span>
        ))}
      </div>
    </div>
  )
}

export function HBars({ rows }: { rows: { label: string; value: number; display: string }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 0) || 1
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div className="hbar-row" key={r.label}>
          <span className="hbar-label">{r.label}</span>
          <span className="hbar-track">
            <span className="hbar" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="hbar-value">{r.display}</span>
        </div>
      ))}
    </div>
  )
}
