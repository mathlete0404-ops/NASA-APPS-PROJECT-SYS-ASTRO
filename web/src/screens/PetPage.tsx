// Crew pet page: the pet, hatching it, today's care and how it grows.
// Growth rules live in engine/pet.ts (showing up only, never health results).
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CheckCircle2, Circle, Lock, PawPrint, Sparkles, Sprout } from 'lucide-react'
import { activeProfile, useStore } from '../data/store'
import { MOOD_LABEL, petState, STAGES, XP } from '../engine/pet'
import { MOOD_NOTE, Pet, PetName, readHatched, readName, writeHatched, writeName } from '../components/Pet'

export function PetPage({ go }: { go: (t: string) => void }) {
  const p = activeProfile(useStore())
  if (!p) return null
  return <PetPageFor key={p.id} crewId={p.id} go={go} />
}

const TAPS_TO_HATCH = 3

function PetPageFor({ crewId, go }: { crewId: string; go: (t: string) => void }) {
  const s = useStore()
  const pet = petState(s, crewId)
  const [name, setName] = useState(() => readName(crewId))
  const [hatched, setHatched] = useState(() => readHatched(crewId))
  const [taps, setTaps] = useState(0)
  const [burst, setBurst] = useState(false)
  const [pop, setPop] = useState(false)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const ready = !hatched && pet.checkDays >= 1
  const stageId = hatched ? pet.stage.id : 'egg'
  const stage = STAGES.find((x) => x.id === stageId)!
  const left = pet.next ? pet.next.min - pet.checkDays : 0

  const tapEgg = () => {
    if (!ready || burst) return
    const n = taps + 1
    setTaps(n)
    if (n < TAPS_TO_HATCH) return
    setBurst(true)
    timers.current.push(window.setTimeout(() => { setHatched(true); writeHatched(crewId); setPop(true) }, 420))
    timers.current.push(window.setTimeout(() => { setBurst(false); setPop(false) }, 1500))
  }

  const hint = ready
    ? taps === 0 ? 'Your egg is ready. Tap it three times to hatch it.' : taps < TAPS_TO_HATCH ? `It's cracking… ${TAPS_TO_HATCH - taps} more` : 'Here it comes!'
    : !hatched ? 'Do your first daily check and the egg will be ready to hatch.' : null
  const art = <Pet stage={stageId} mood={pet.mood} name={name} size={220} cracks={taps} ready={ready} burst={burst} pop={pop} />

  return (
    <div className="grid g2 pet-page">
      <div className="card pet-hero">
        <div className="card-h"><span className="ic"><PawPrint /></span><h3>Your crew pet</h3><span className="sub">{pet.xp} care points</span></div>
        {ready
          ? <button type="button" className="pet-stage-big tappable" onClick={tapEgg} aria-label={`Tap to hatch (${TAPS_TO_HATCH - taps} taps left)`}>{art}</button>
          : <div className="pet-stage-big">{art}</div>}
        {hint && <p className={`pet-hint${ready ? ' ready' : ''}`}>{hint}</p>}
        {!hatched && !ready && <button className="btn primary" onClick={() => go('check')}>Start today’s check</button>}
        <PetName name={name} onSave={(n) => { setName(n); writeName(crewId, n) }} />
        <div className="pet-tags">
          <span className="pill">{stage.name}</span>
          {hatched && <span className={`pet-mood m-${pet.mood}`}>{MOOD_LABEL[pet.mood]}</span>}
        </div>
        {hatched && (
          <>
            <p className="pet-note">{stage.note}</p>
            <div className="progress" role="progressbar" aria-label={pet.next ? `Progress to ${pet.next.name}` : 'Top stage reached'}
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pet.progress * 100)}>
              <span style={{ width: `${Math.round(pet.progress * 100)}%` }} />
            </div>
            <small className="muted">{pet.next ? `${left} more daily check${left === 1 ? '' : 's'} to ${pet.next.name}` : 'Top stage reached.'}</small>
          </>
        )}
        <small className="pet-streak">
          {pet.streak > 0 ? `${pet.streak}-day streak · best ${pet.bestStreak}`
            : pet.bestStreak > 0 ? `Best streak ${pet.bestStreak} day${pet.bestStreak === 1 ? '' : 's'}. A new one starts with your next check.`
              : 'Your streak starts with your first check.'}
        </small>
      </div>

      <div className="stack">
        <div className="card">
          <div className="card-h"><span className="ic"><Sprout /></span><h3>Today’s care</h3><span className="sub">{pet.tasks.filter((t) => t.done).length}/3</span></div>
          <p className="pet-mood-note" style={{ marginTop: 0 }}>{MOOD_NOTE[pet.mood]}</p>
          <div className="pet-tasks">
            {pet.tasks.map((t) => {
              const inner = (
                <>
                  {t.done ? <CheckCircle2 size={18} className="pet-task-ic done" /> : <Circle size={18} className="pet-task-ic" />}
                  <span className="pet-task-l">{t.label}{t.byPainReport && <small> · pain report counts as care</small>}</span>
                  <small className="mono">+{t.id === 'check' ? XP.check : t.id === 'move' ? XP.move : XP.eat}</small>
                  {!t.done && <ArrowRight size={15} />}
                </>
              )
              return t.done
                ? <div key={t.id} className="pet-task done">{inner}<span className="sr-only">done</span></div>
                : <button key={t.id} className="pet-task" onClick={() => go(t.tab)}>{inner}</button>
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-h"><span className="ic"><Sparkles /></span><h3>How it grows</h3></div>
          <div className="pet-ladder">
            {STAGES.map((st) => {
              const reached = st.id === 'egg' || (hatched && pet.checkDays >= st.min)
              const current = st.id === stageId
              return (
                <div key={st.id} className={`pet-rung${reached ? '' : ' locked'}${current ? ' current' : ''}`}>
                  <span className="pet-rung-art"><Pet stage={st.id} mood="content" name={st.name} size={52} /></span>
                  <span className="pet-rung-t"><b>{st.name}</b><small>{st.id === 'egg' ? 'Start' : `${st.min} check day${st.min === 1 ? '' : 's'}`}</small></span>
                  {!reached && <Lock size={14} className="muted" />}
                </div>
              )
            })}
          </div>
          <p className="pet-foot-note"><small>It grows when you show up: daily check +{XP.check}, exercise +{XP.move}, log food +{XP.eat}, pain report +{XP.pain}. Your results never change it, and missed days only make it sleepy.</small></p>
        </div>
      </div>
    </div>
  )
}
