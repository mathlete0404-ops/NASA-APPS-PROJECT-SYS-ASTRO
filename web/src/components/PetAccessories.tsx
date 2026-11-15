// Artwork for the pet shop. Every piece is drawn in the pet's own 140x130 coordinate space, so
// it sits on the creature exactly as in the shop preview. Original drawings, no agency marks.
import type { ReactNode } from 'react'
import { useId } from 'react'
import type { Slot } from '../engine/petshop'

export const Star = ({ cx, cy, r, className }: { cx: number; cy: number; r: number; className: string }) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rr = i % 2 ? r * 0.45 : r
    return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`
  })
  return <polygon className={className} points={pts.join(' ')} />
}

const SPACE = 'hsl(236 48% 15%)'

/** Small fixed star field shared by the scenes (positions are fixed so the picture never jumps). */
const STARS: [number, number, number, boolean][] = [
  [40, 40, 1.4, true], [56, 28, 1, false], [92, 34, 1.6, true], [104, 58, 1, false], [34, 68, 1.1, false],
  [102, 80, 1.3, true], [48, 92, .9, false], [86, 22, 1, false], [72, 18, .9, true], [110, 46, 1, false], [30, 52, .9, false],
]
const Stars = ({ n = STARS.length }: { n?: number }) => (
  <g>{STARS.slice(0, n).map(([x, y, r, tw], i) => <circle key={i} className={tw ? 'pet-star tw' : 'pet-star'} cx={x} cy={y} r={r} style={tw ? { animationDelay: `${(i % 4) * 0.5}s` } : undefined} />)}</g>
)

// ── Hats ──────────────────────────────────────────────────────────────────────
const Beanie = () => (
  <g>
    <path className="pet-ac-wool" d="M47 64 C46 48 58 43 70 43 C82 43 94 48 93 64 Q70 58 47 64 Z" />
    <path className="pet-ac-stripe" d="M48.5 57 Q70 51 91.5 57 L91 61 Q70 55 49 61 Z" />
    <path className="pet-ac-cuff" d="M47 62 Q70 56 93 62 L92.4 68.5 Q70 62.5 47.6 68.5 Z" />
  </g>
)
const Headphones = () => (
  <g>
    <path className="pet-ac-band" d="M44 74 C42 48 98 48 96 74" />
    <ellipse className="pet-ac-cup" cx={43} cy={75} rx={5} ry={8} />
    <ellipse className="pet-ac-cup" cx={97} cy={75} rx={5} ry={8} />
    <ellipse className="pet-ac-cup-in" cx={43} cy={75} rx={2.2} ry={4.4} />
    <ellipse className="pet-ac-cup-in" cx={97} cy={75} rx={2.2} ry={4.4} />
  </g>
)
const Captain = () => (
  <g>
    <path className="pet-ac-navy" d="M49 63 Q48 46 70 46 Q92 46 91 63 Z" />
    <path className="pet-ac-trim" d="M49.5 60 Q70 55 90.5 60 L91 63.4 Q70 58.6 49 63.4 Z" />
    <path className="pet-ac-brim" d="M46 63 Q70 58 94 63 Q94 69.5 70 68 Q46 69.5 46 63 Z" />
    <Star cx={70} cy={53} r={4} className="pet-gold" />
  </g>
)
const Crown = () => (
  <g>
    <path className="pet-gold pet-ac-crown" d="M51 63 L54 46 L62 56 L70 42 L78 56 L86 46 L89 63 Q70 68 51 63 Z" />
    <path className="pet-ac-trim-line" d="M52 60.5 Q70 65.5 88 60.5" />
    <circle className="pet-ac-gem" cx={54} cy={46} r={2.2} />
    <circle className="pet-ac-gem" cx={70} cy={42} r={2.5} />
    <circle className="pet-ac-gem" cx={86} cy={46} r={2.2} />
  </g>
)

// ── Faces (eyes sit at x 60 / 80, y 72-76) ─────────────────────────────────────
const Glasses = () => (
  <g>
    <circle className="pet-ac-lens" cx={60} cy={74} r={7.6} />
    <circle className="pet-ac-lens" cx={80} cy={74} r={7.6} />
    <path className="pet-ac-frame" d="M67.4 73 Q70 71 72.6 73" />
    <path className="pet-ac-frame" d="M52.4 73 L48.5 71.5 M87.6 73 L91.5 71.5" />
  </g>
)
const heart = 'M0 3.6 C-3.4 -2.2 -10 .4 -7.6 5.6 C-6.4 8.4 0 13 0 13 S6.4 8.4 7.6 5.6 C10 .4 3.4 -2.2 0 3.6 Z'
const Hearts = () => (
  <g>
    <path className="pet-ac-heart" d={heart} transform="translate(60 67.6)" />
    <path className="pet-ac-heart" d={heart} transform="translate(80 67.6)" />
    <path className="pet-ac-frame" d="M67 74 Q70 72.2 73 74" />
  </g>
)
const Visor = () => {
  const id = useId().replace(/:/g, '')
  return (
    <g>
      <defs>
        <linearGradient id={`v${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="hsl(262 70% 40%)" /><stop offset="1" stopColor="hsl(190 80% 38%)" />
        </linearGradient>
      </defs>
      <rect x={49} y={67.5} width={42} height={13} rx={6.5} fill={`url(#v${id})`} opacity={0.86} className="pet-ac-visor" />
      <path className="pet-ac-glint" d="M55 71 L62 71 M57 74 L60 74" />
    </g>
  )
}

// ── Backs (drawn behind the body) ──────────────────────────────────────────────
const Cape = () => (
  <g>
    <path className="pet-ac-cape" d="M50 63 Q35 84 26 110 Q70 123 114 110 Q105 84 90 63 Z" />
    <path className="pet-ac-trim-line" d="M27 108 Q70 121 113 108" />
  </g>
)
const Wings = () => (
  <g className="pet-ac-wings">
    <g className="wing l">
      <ellipse className="pet-ac-wing" cx={36} cy={68} rx={17} ry={9.5} transform="rotate(-32 36 68)" />
      <ellipse className="pet-ac-wing b" cx={40} cy={85} rx={11.5} ry={6.5} transform="rotate(24 40 85)" />
    </g>
    <g className="wing r">
      <ellipse className="pet-ac-wing" cx={104} cy={68} rx={17} ry={9.5} transform="rotate(32 104 68)" />
      <ellipse className="pet-ac-wing b" cx={100} cy={85} rx={11.5} ry={6.5} transform="rotate(-24 100 85)" />
    </g>
  </g>
)

// ── Scenes (inside the helmet glass) ───────────────────────────────────────────
const Starfield = () => (<g><Stars /></g>)
const Moon = () => (
  <g>
    <Stars n={7} />
    <circle cx={38} cy={38} r={11} fill="hsl(48 92% 88%)" />
    <circle cx={43} cy={34.5} r={10} fill={SPACE} />
  </g>
)
const Planet = () => (
  <g>
    <Stars n={7} />
    <g transform="rotate(-20 98 40)">
      <path d="M81 40 A17 4.6 0 0 1 115 40" fill="none" stroke="hsl(44 80% 62%)" strokeWidth={1.8} opacity={0.8} />
      <circle cx={98} cy={40} r={10.5} fill="hsl(22 88% 60%)" />
      <path d="M89 37 Q98 41 107 36.4" fill="none" stroke="hsl(14 70% 46%)" strokeWidth={1.4} opacity={0.7} />
      <path d="M81 40 A17 4.6 0 0 0 115 40" fill="none" stroke="hsl(44 90% 76%)" strokeWidth={1.9} />
    </g>
  </g>
)
const Aurora = () => {
  const id = useId().replace(/:/g, '')
  return (
    <g>
      <defs><filter id={`b${id}`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.4" /></filter></defs>
      <Stars n={6} />
      <g filter={`url(#b${id})`}>
        <path d="M20 54 Q42 26 68 44 T120 36" fill="none" stroke="hsl(160 88% 58%)" strokeWidth={8} strokeLinecap="round" opacity={0.6} />
        <path d="M18 70 Q46 46 72 62 T122 54" fill="none" stroke="hsl(266 84% 66%)" strokeWidth={7} strokeLinecap="round" opacity={0.5} />
        <path d="M24 40 Q48 24 74 34 T116 24" fill="none" stroke="hsl(190 90% 60%)" strokeWidth={5} strokeLinecap="round" opacity={0.4} />
      </g>
    </g>
  )
}

/** One drawing per shop item. A test keeps this in step with the catalog. */
export const ART: Record<string, () => ReactNode> = {
  beanie: Beanie, headphones: Headphones, captain: Captain, crown: Crown,
  glasses: Glasses, hearts: Hearts, visor: Visor,
  cape: Cape, wings: Wings,
  stars: Starfield, moon: Moon, planet: Planet, aurora: Aurora,
}

const draw = (id: string | undefined) => {
  const A = id ? ART[id] : undefined
  return A ? <A /> : null
}

/** Space behind the pet, clipped to the helmet glass. */
export function SceneLayer({ id }: { id?: string }) {
  const clip = `sc${useId().replace(/:/g, '')}`
  if (!id || !ART[id]) return null
  return (
    <g>
      <clipPath id={clip}><circle cx={70} cy={62} r={45} /></clipPath>
      <g clipPath={`url(#${clip})`}>
        <circle cx={70} cy={62} r={45} fill={SPACE} />
        {draw(id)}
      </g>
    </g>
  )
}

export const BackLayer = ({ id }: { id?: string }) => <>{draw(id)}</>
export const FrontLayer = ({ head, face }: { head?: string; face?: string }) => <>{draw(face)}{draw(head)}</>

export type Worn = Partial<Record<Slot, string>>
