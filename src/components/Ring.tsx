import type { ReactNode } from 'react'

/** Progress ring; overflows past 100% wrap a second, hotter lap. */
export function Ring({ value, max, size = 168, children }: { value: number; max: number; size?: number; children?: ReactNode }) {
  const stroke = 12
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const ratio = max > 0 ? value / max : 0
  const first = Math.min(ratio, 1)
  const over = Math.min(Math.max(ratio - 1, 0), 1)
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className={ratio > 1 ? 'ring-fill full' : 'ring-fill'}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${first * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        {over > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            className="ring-over"
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${over * c} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  )
}
