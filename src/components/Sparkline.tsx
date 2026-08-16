const W = 240
const H = 48
const PAD = 4

/**
 * The progress line: one point per training day, oldest on the left.
 *
 * The viewBox is stretched to the container width, so anything round would
 * turn into an ellipse — markers are vertical hairlines instead, and the
 * stroke is exempted from scaling.
 */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1

  const x = (index: number) => (index / (values.length - 1)) * W
  const y = (value: number) => H - PAD - ((value - min) / span) * (H - PAD * 2)

  const line = values.map((value, index) => `${x(index)},${y(value)}`).join(' ')
  const last = values.length - 1

  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline
        points={line}
        fill="none"
        stroke="var(--fg-dim)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={x(last)}
        y1={0}
        x2={x(last)}
        y2={H}
        stroke="var(--fg)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
