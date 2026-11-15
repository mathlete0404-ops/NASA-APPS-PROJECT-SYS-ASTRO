// Crew pet: an original little space critter in a glass helmet. It grows from showing
// up (see engine/pet.ts) and never reacts to health results.
import { useState } from 'react'
import { ArrowRight, Check, PawPrint, Pencil, X } from 'lucide-react'
import { activeProfile, useStore } from '../data/store'
import { HATCH_DAYS, MOOD_LABEL, petState, STAGES, type Mood, type StageId } from '../engine/pet'
import { outfit } from '../engine/petshop'
import { useWardrobe } from '../data/wardrobe'
import { BackLayer, FrontLayer, SceneLayer, Star, type Worn } from './PetAccessories'

const STAGE_ORDER: StageId[] = STAGES.map((s) => s.id)
const atLeast = (stage: StageId, min: StageId) => STAGE_ORDER.indexOf(stage) >= STAGE_ORDER.indexOf(min)
const BODY_SCALE: Record<StageId, number> = { egg: 1, hatchling: 0.8, cadet: 0.9, explorer: 1, veteran: 1 }

const Sparkle = ({ x, y, s, delay }: { x: number; y: number; s: number; delay: string }) => (
  <path className="pet-sparkle" style={{ animationDelay: delay }}
    d={`M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s} Z`} />
)

function Face({ mood }: { mood: Mood }) {
  const eye = (x: number, dy = 0) => (
    <g key={x}>
      <circle className="pet-ink" cx={x} cy={74 + dy} r={4.4} />
      <circle className="pet-shine" cx={x + 1.4} cy={72.4 + dy} r={1.4} />
    </g>
  )
  return (
    <g>
      <ellipse className="pet-cheek" cx={51} cy={83} rx={4.5} ry={2.6} />
      <ellipse className="pet-cheek" cx={89} cy={83} rx={4.5} ry={2.6} />
      {mood === 'thriving' && (
        <>
          <path className="pet-line" d="M55.5 76 Q60 69 64.5 76" />
          <path className="pet-line" d="M75.5 76 Q80 69 84.5 76" />
          <path className="pet-ink" d="M62 83 Q70 93 78 83 Z" />
        </>
      )}
      {mood === 'happy' && <>{eye(60)}{eye(80)}<path className="pet-line" d="M63 84 Q70 90 77 84" /></>}
      {mood === 'content' && <>{eye(60)}{eye(80)}<path className="pet-line" d="M65.5 85 Q70 88 74.5 85" /></>}
      {mood === 'waiting' && (
        <>
          {eye(60, -1.5)}{eye(80, -1.5)}
          <path className="pet-line" d="M65 85 Q70 89 75 85" />
        </>
      )}
      {mood === 'sleepy' && (
        <>
          <path className="pet-line" d="M55.5 74 Q60 78.5 64.5 74" />
          <path className="pet-line" d="M75.5 74 Q80 78.5 84.5 74" />
          <ellipse className="pet-ink" cx={70} cy={86} rx={2.2} ry={1.8} />
        </>
      )}
    </g>
  )
}

/** The creature itself. Purely visual; all state comes from props. */
export function Pet({ stage, mood, name = 'Your pet', size = 140, cracks = 0, ready = false, burst = false, pop = false, nudge = 0, hearts = 0, wear }: {
  stage: StageId; mood: Mood; name?: string; size?: number
  /** Egg only: 0..3 taps so far (adds cracks and a shake). */ cracks?: number
  /** Egg only: ready to hatch (wobbles more). */ ready?: boolean
  /** Hatch moment: flash, ring and sparkles. */ burst?: boolean
  /** Just hatched: the creature pops in. */ pop?: boolean
  /** Increments on each tap: replays the shake (egg) or a hop (creature). */ nudge?: number
  /** Increments on each pat: a heart floats up. */ hearts?: number
  /** Shop accessories to draw (hatched pets only). */ wear?: Worn
}) {
  const stageName = STAGES.find((s) => s.id === stage)?.name ?? stage
  const label = `${name}, your pet. ${stageName} stage, ${MOOD_LABEL[mood].toLowerCase()}`
  const sc = BODY_SCALE[stage]
  return (
    <svg className={`pet-svg mood-${mood}`} viewBox="0 0 140 130" width={size} height={(size * 130) / 140} role="img" aria-label={label}>
      <title>{label}</title>
      <ellipse className="pet-shadow" cx={70} cy={123} rx={42} ry={4} />

      {atLeast(stage, 'veteran') && (
        <g>
          <line className="pet-pole" x1={121} y1={116} x2={121} y2={70} />
          <path className="pet-flag" d="M121 70 H137 L133 76 L137 82 H121 Z" />
          <Star cx={127.5} cy={76} r={3} className="pet-gold" />
        </g>
      )}

      <circle className="pet-glass" cx={70} cy={62} r={46} />
      {stage !== 'egg' && <SceneLayer id={wear?.scene} />}

      {stage === 'egg' ? (
        <g className={`pet-egg-wobble${ready ? ' ready' : ''}`}><g key={nudge} className={nudge ? 'pet-egg-shake' : undefined}>
          <path className="pet-egg" d="M70 52 C86 52 92 76 92 87 C92 99 82 106 70 106 C58 106 48 99 48 87 C48 76 54 52 70 52 Z" />
          <circle className="pet-speck-a" cx={62} cy={70} r={2.6} />
          <circle className="pet-speck-b" cx={77} cy={64} r={2} />
          <circle className="pet-speck-a" cx={81} cy={86} r={3} />
          <circle className="pet-speck-b" cx={59} cy={92} r={2.2} />
          <circle className="pet-speck-b" cx={70} cy={80} r={1.6} />
          <circle className="pet-speck-a" cx={69} cy={98} r={1.8} />
          {cracks >= 1 && <path className="pet-crack" d="M63 60 L66 66 L61 71 L66 76" />}
          {cracks >= 2 && <path className="pet-crack" d="M84 74 L79 79 L84 84 L80 90" />}
          {cracks >= 3 && <path className="pet-crack" d="M49 84 L55 80 L61 86 L67 79 L73 86 L79 80 L85 85 L91 82" />}
        </g></g>
      ) : (
        <g className={pop ? 'pet-pop' : undefined}><g key={nudge} className={nudge && !pop ? 'pet-hop' : undefined}><g className="pet-bob">
          <g transform={`translate(70 106) scale(${sc}) translate(-70 -106)`}>
            <BackLayer id={wear?.back} />
            {atLeast(stage, 'explorer') && (
              <g>
                <rect className="pet-pack" x={33} y={68} width={11} height={25} rx={5.5} />
                <rect className="pet-pack" x={96} y={68} width={11} height={25} rx={5.5} />
                <rect className="pet-nozzle" x={35} y={92} width={7} height={4} rx={1.5} />
                <rect className="pet-nozzle" x={98} y={92} width={7} height={4} rx={1.5} />
              </g>
            )}
            <path className="pet-stalk" d="M70 57 Q68 47 74 40" />
            <circle className={atLeast(stage, 'cadet') ? 'pet-bulb on' : 'pet-bulb'} cx={74.5} cy={38} r={4.6} />
            <ellipse className="pet-arm" cx={43} cy={86} rx={5} ry={7} transform="rotate(20 43 86)" />
            {mood === 'waiting'
              ? <ellipse className="pet-arm pet-wave" cx={101} cy={68} rx={5} ry={7.5} transform="rotate(35 101 68)" />
              : <ellipse className="pet-arm" cx={97} cy={86} rx={5} ry={7} transform="rotate(-20 97 86)" />}
            <ellipse className="pet-body" cx={70} cy={81} rx={28} ry={25} />
            <ellipse className="pet-belly" cx={70} cy={92} rx={16} ry={10} />
            <ellipse className="pet-foot" cx={59} cy={105} rx={7.5} ry={3.6} />
            <ellipse className="pet-foot" cx={81} cy={105} rx={7.5} ry={3.6} />
            <Face mood={mood} />

            <FrontLayer head={wear?.head} face={wear?.face} />
            {atLeast(stage, 'cadet') && <Star cx={70} cy={97} r={5.2} className="pet-gold pet-badge" />}
          </g>
        </g></g></g>
      )}
      {hearts > 0 && <path key={hearts} className="pet-heart" d="M104 40 c-3 -5 -11 -3 -9 3 c1 3 9 8 9 8 s8 -5 9 -8 c2 -6 -6 -8 -9 -3z" />}
      {burst && (
        <g className="pet-burst">
          <circle className="pet-flash" cx={70} cy={80} r={30} />
          <circle className="pet-ring" cx={70} cy={80} r={30} />
          <Sparkle x={34} y={52} s={6} delay="0s" /><Sparkle x={108} y={48} s={5} delay=".1s" /><Sparkle x={96} y={22} s={4} delay=".2s" /><Sparkle x={44} y={24} s={4} delay=".15s" />
        </g>
      )}

      <rect className="pet-base" x={28} y={104} width={84} height={14} rx={7} />
      <circle className="pet-light" cx={52} cy={111} r={1.8} />
      <circle className="pet-light" cx={70} cy={111} r={1.8} />
      <circle className="pet-light" cx={88} cy={111} r={1.8} />

      <path className="pet-glare" d="M38 46 A34 34 0 0 1 58 24" />
      <circle className="pet-glare-dot" cx={34} cy={57} r={2} />

      {mood === 'thriving' && <><Sparkle x={36} y={30} s={5} delay="0s" /><Sparkle x={106} y={40} s={4} delay=".8s" /><Sparkle x={100} y={20} s={3} delay="1.5s" /></>}
      {mood === 'sleepy' && (
        <g className="pet-z">
          <text x={94} y={40} fontSize={11}>z</text>
          <text x={102} y={29} fontSize={8}>z</text>
        </g>
      )}
    </svg>
  )
}

const DEFAULT_NAME = 'Orbit'
const nameKey = (crewId: string) => `crew-mirror:pet-name:${crewId}`
const hatchKey = (crewId: string) => `crew-mirror:pet-hatched:${crewId}`
export const readName = (crewId: string) => { try { return localStorage.getItem(nameKey(crewId)) || DEFAULT_NAME } catch { return DEFAULT_NAME } }
export const writeName = (crewId: string, name: string) => { try { localStorage.setItem(nameKey(crewId), name) } catch { /* private mode: keep it in memory */ } }
/** The pet stays an egg until the crew member hatches it by hand (after their first check). */
export const readHatched = (crewId: string) => { try { return localStorage.getItem(hatchKey(crewId)) === '1' } catch { return false } }
export const writeHatched = (crewId: string) => { try { localStorage.setItem(hatchKey(crewId), '1') } catch { /* keep it in memory */ } }

export const MOOD_NOTE: Record<Mood, string> = {
  thriving: 'All three care tasks done today.',
  happy: 'Two of three care tasks done today.',
  content: 'One care task done today.',
  waiting: 'Ready when you are.',
  sleepy: 'Napping until your next check. Nothing is lost.',
}

export function PetName({ name, onSave }: { name: string; onSave: (n: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const save = () => {
    if (draft === null) return
    onSave(draft.trim().slice(0, 20) || DEFAULT_NAME)
    setDraft(null)
  }
  if (draft !== null) {
    return (
      <form className="pet-name-row" onSubmit={(e) => { e.preventDefault(); save() }}>
        <input className="pet-name-input" aria-label="Pet name" value={draft} maxLength={20} autoFocus
          onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setDraft(null) }} />
        <button type="submit" className="btn small icon" aria-label="Save name"><Check /></button>
        <button type="button" className="btn small ghost icon" aria-label="Cancel" onClick={() => setDraft(null)}><X /></button>
      </form>
    )
  }
  return (
    <div className="pet-name-row">
      <strong className="pet-name">{name}</strong>
      <button className="btn ghost icon small" aria-label="Rename pet" title="Rename" onClick={() => setDraft(name)}><Pencil /></button>
    </div>
  )
}

/** Today screen: one small row that opens the pet page. */
export function PetMini() {
  const s = useStore()
  const p = activeProfile(s)
  const [wardrobe] = useWardrobe(p?.id ?? '')
  if (!p) return null
  const pet = petState(s, p.id)
  const hatched = readHatched(p.id)
  const ready = !hatched && pet.incubation >= 1
  const low = [...pet.needs].sort((a, b) => a.level - b.level)[0]
  return (
    <a className="card pet-mini" href="#/app/pet">
      <span className="pet-mini-art"><Pet stage={hatched ? pet.stage.id : 'egg'} mood={pet.mood} name={readName(p.id)} size={64} ready={ready} cracks={hatched ? 0 : Math.min(2, pet.checkDays)} wear={hatched ? outfit(wardrobe) : undefined} /></span>
      <span className="pet-mini-t">
        <small className="kicker"><PawPrint size={12} /> Crew pet</small>
        <b>{readName(p.id)}</b>
        <small>{ready ? 'Ready to hatch! Tap to open.' : !hatched ? `An egg · ${Math.min(pet.checkDays, HATCH_DAYS)}/${HATCH_DAYS} daily checks to hatch` : low.level < 50 ? low.hungry : `${pet.stage.name} · ${MOOD_LABEL[pet.mood]}`}</small>
      </span>
      <ArrowRight size={16} />
    </a>
  )
}
