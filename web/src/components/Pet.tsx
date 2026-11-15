// Crew pet: an original little space critter in a glass helmet. It grows from showing
// up (see engine/pet.ts) and never reacts to health results.
import { useState } from 'react'
import { ArrowRight, Check, CheckCircle2, Circle, PawPrint, Pencil, X } from 'lucide-react'
import { activeProfile, useStore } from '../data/store'
import { MOOD_LABEL, petState, STAGES, type Mood, type StageId } from '../engine/pet'

const STAGE_ORDER: StageId[] = STAGES.map((s) => s.id)
const atLeast = (stage: StageId, min: StageId) => STAGE_ORDER.indexOf(stage) >= STAGE_ORDER.indexOf(min)
const BODY_SCALE: Record<StageId, number> = { egg: 1, hatchling: 0.8, cadet: 0.9, explorer: 1, veteran: 1 }

const Star = ({ cx, cy, r, className }: { cx: number; cy: number; r: number; className: string }) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rr = i % 2 ? r * 0.45 : r
    return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`
  })
  return <polygon className={className} points={pts.join(' ')} />
}
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
export function Pet({ stage, mood, name = 'Your pet', size = 140 }: { stage: StageId; mood: Mood; name?: string; size?: number }) {
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

      {stage === 'egg' ? (
        <g className="pet-egg-wobble">
          <path className="pet-egg" d="M70 52 C86 52 92 76 92 87 C92 99 82 106 70 106 C58 106 48 99 48 87 C48 76 54 52 70 52 Z" />
          <circle className="pet-speck-a" cx={62} cy={70} r={2.6} />
          <circle className="pet-speck-b" cx={77} cy={64} r={2} />
          <circle className="pet-speck-a" cx={81} cy={86} r={3} />
          <circle className="pet-speck-b" cx={59} cy={92} r={2.2} />
          <circle className="pet-speck-b" cx={70} cy={80} r={1.6} />
          <circle className="pet-speck-a" cx={69} cy={98} r={1.8} />
        </g>
      ) : (
        <g className="pet-bob">
          <g transform={`translate(70 106) scale(${sc}) translate(-70 -106)`}>
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
            {atLeast(stage, 'cadet') && <Star cx={70} cy={97} r={5.2} className="pet-gold pet-badge" />}
          </g>
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
const readName = (crewId: string) => { try { return localStorage.getItem(nameKey(crewId)) || DEFAULT_NAME } catch { return DEFAULT_NAME } }
const writeName = (crewId: string, name: string) => { try { localStorage.setItem(nameKey(crewId), name) } catch { /* private mode: keep it in memory */ } }

const MOOD_NOTE: Record<Mood, string> = {
  thriving: 'All three care tasks done today.',
  happy: 'Two of three care tasks done today.',
  content: 'One care task done today.',
  waiting: 'Ready when you are.',
  sleepy: 'Napping until your next check. Nothing is lost.',
}

function PetName({ name, onSave }: { name: string; onSave: (n: string) => void }) {
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

/** Today screen card: the pet, its stage, streak and today's three care tasks. */
export function PetCard({ go }: { go: (tab: string) => void }) {
  const p = activeProfile(useStore())
  if (!p) return null
  return <PetCardFor key={p.id} crewId={p.id} go={go} />
}

function PetCardFor({ crewId, go }: { crewId: string; go: (tab: string) => void }) {
  const s = useStore()
  const [name, setName] = useState(() => readName(crewId))
  const pet = petState(s, crewId)
  const left = pet.next ? pet.next.min - pet.checkDays : 0
  return (
    <div className="card pet-card">
      <div className="card-h"><span className="ic"><PawPrint /></span><h3>Crew pet</h3><span className="sub">{pet.xp} care points</span></div>
      <div className="pet-top">
        <div className="pet-stage-wrap"><Pet stage={pet.stage.id} mood={pet.mood} name={name} /></div>
        <div className="pet-info">
          <PetName name={name} onSave={(n) => { setName(n); writeName(crewId, n) }} />
          <div className="pet-tags">
            <span className="pill">{pet.stage.name}</span>
            <span className={`pet-mood m-${pet.mood}`}>{MOOD_LABEL[pet.mood]}</span>
          </div>
          <p className="pet-note">{pet.stage.note}</p>
          <div className="progress" role="progressbar" aria-label={pet.next ? `Progress to ${pet.next.name}` : 'Top stage reached'}
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pet.progress * 100)}>
            <span style={{ width: `${Math.round(pet.progress * 100)}%` }} />
          </div>
          <small className="muted">{pet.next ? `${left} more daily check${left === 1 ? '' : 's'} to ${pet.next.name}` : 'Top stage reached.'}</small>
          <small className="pet-streak">
            {pet.streak > 0 ? `${pet.streak}-day streak · best ${pet.bestStreak}`
              : pet.bestStreak > 0 ? `Best streak ${pet.bestStreak} day${pet.bestStreak === 1 ? '' : 's'}. A new one starts with your next check.`
                : 'Your streak starts with your first check.'}
          </small>
        </div>
      </div>

      <p className="pet-mood-note"><b>Today’s care</b> · {MOOD_NOTE[pet.mood]}</p>
      <div className="pet-tasks" aria-label="Today’s care">
        {pet.tasks.map((t) => {
          const inner = (
            <>
              {t.done ? <CheckCircle2 size={18} className="pet-task-ic done" /> : <Circle size={18} className="pet-task-ic" />}
              <span className="pet-task-l">
                {t.label}
                {t.byPainReport && <small> · pain report counts as care</small>}
              </span>
              {!t.done && <ArrowRight size={15} />}
            </>
          )
          return t.done
            ? <div key={t.id} className="pet-task done">{inner}<span className="sr-only">done</span></div>
            : <button key={t.id} className="pet-task" onClick={() => go(t.tab)}>{inner}</button>
        })}
      </div>
      <p className="pet-foot-note"><small>Grows when you show up. Your results never change it.</small></p>
    </div>
  )
}
