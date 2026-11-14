// 2D body map (front + back). Fallback for the Z-Anatomy 3D model (see README "Known limitations").
import type { Region } from '../engine/triage'

type Shape = { region: Region; d?: string; cx?: number; cy?: number; rx?: number; ry?: number; side?: 'left' | 'right' | 'middle' }

// Viewer's left = person's right (front view).
const FRONT: Shape[] = [
  { region: 'head', cx: 80, cy: 30, rx: 20, ry: 24, side: 'middle' },
  { region: 'neck', d: 'M71 52h18v14H71z', side: 'middle' },
  { region: 'shoulder', cx: 50, cy: 76, rx: 14, ry: 11, side: 'right' },
  { region: 'shoulder', cx: 110, cy: 76, rx: 14, ry: 11, side: 'left' },
  { region: 'hip', cx: 64, cy: 170, rx: 14, ry: 12, side: 'right' },
  { region: 'hip', cx: 96, cy: 170, rx: 14, ry: 12, side: 'left' },
  { region: 'knee', cx: 66, cy: 238, rx: 10, ry: 11, side: 'right' },
  { region: 'knee', cx: 94, cy: 238, rx: 10, ry: 11, side: 'left' },
  { region: 'ankle_foot', d: 'M56 300h18v14h-22z', side: 'right' },
  { region: 'ankle_foot', d: 'M86 300h18l4 14H86z', side: 'left' },
]
const BACK: Shape[] = [
  { region: 'neck', d: 'M71 52h18v14H71z', side: 'middle' },
  { region: 'upper_back', d: 'M58 70h44v44H58z', side: 'middle' },
  { region: 'lower_back', d: 'M60 118h40v34H60z', side: 'middle' },
  { region: 'shoulder', cx: 50, cy: 76, rx: 14, ry: 11, side: 'left' },
  { region: 'shoulder', cx: 110, cy: 76, rx: 14, ry: 11, side: 'right' },
  { region: 'hip', cx: 64, cy: 170, rx: 14, ry: 12, side: 'left' },
  { region: 'hip', cx: 96, cy: 170, rx: 14, ry: 12, side: 'right' },
  { region: 'knee', cx: 66, cy: 238, rx: 10, ry: 11, side: 'left' },
  { region: 'knee', cx: 94, cy: 238, rx: 10, ry: 11, side: 'right' },
  { region: 'ankle_foot', d: 'M56 300h18v14H56z', side: 'left' },
  { region: 'ankle_foot', d: 'M86 300h18v14H86z', side: 'right' },
]
const OUTLINE =
  'M80 4c14 0 22 11 22 26 0 12-6 20-13 23v6c10 2 26 6 34 12 8 6 9 30 10 52l3 50c1 6-6 7-8 1l-8-48-4-22-3 30 3 34c2 12 2 26 0 40l-6 54 2 46c0 6-6 8-20 8-2-30-1-62-1-88l-5-40-1 0-5 40c0 26 1 58-1 88-14 0-20-2-20-8l2-46-6-54c-2-14-2-28 0-40l3-34-3-30-4 22-8 48c-2 6-9 5-8-1l3-50c1-22 2-46 10-52 8-6 24-10 34-12v-6c-7-3-13-11-13-23 0-15 8-26 22-26z'

export function BodyMap({ region, side, onPick }: { region?: Region; side?: string; onPick: (r: Region, side: 'left' | 'right' | 'middle') => void }) {
  const draw = (shapes: Shape[], label: string, dx: number) => (
    <g transform={`translate(${dx},0)`}>
      <path d={OUTLINE} className="outline" />
      {shapes.map((s, i) => {
        const sel = s.region === region && (s.side === side || s.side === 'middle' || side === 'both')
        const common = {
          className: `region${sel ? ' sel' : ''}`,
          onClick: () => onPick(s.region, s.side ?? 'middle'),
          role: 'button',
          'aria-label': `${label} ${s.side ?? ''} ${s.region}`,
        }
        return s.d ? <path key={i} d={s.d} {...common} /> : <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} {...common} />
      })}
      <text x={80} y={334} textAnchor="middle" fill="#8f9bc2" fontSize="11">{label}</text>
    </g>
  )
  return (
    <div className="body-map">
      <svg viewBox="0 0 340 340">
        {draw(FRONT, 'Front', 0)}
        {draw(BACK, 'Back', 180)}
      </svg>
    </div>
  )
}
