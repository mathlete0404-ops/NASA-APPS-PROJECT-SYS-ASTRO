// Crew pet page: the pet, hatching it, today's care and how it grows.
// Growth rules live in engine/pet.ts (showing up only, never health results).
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CheckCircle2, Circle, Heart, Lock, PawPrint, ShoppingBag, Sparkles, Sprout } from 'lucide-react'
import { activeProfile, useStore } from '../data/store'
import { useWardrobe } from '../data/wardrobe'
import { HATCH_DAYS, MOOD_LABEL, petState, STAGES, XP } from '../engine/pet'
import { balance, itemById, outfit } from '../engine/petshop'
import { MOOD_NOTE, Pet, PetName, readHatched, readName, writeHatched, writeName } from '../components/Pet'
import { PetShop } from '../components/PetShop'

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
  const [nudge, setNudge] = useState(0)
  const [hearts, setHearts] = useState(0)
  const [view, setView] = useState<'care' | 'shop'>('care')
  const [tryOn, setTryOn] = useState<string | null>(null)
  const [wardrobe, updateWardrobe] = useWardrobe(crewId)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const ready = !hatched && pet.incubation >= 1
  const stageId = hatched ? pet.stage.id : 'egg'
  const stage = STAGES.find((x) => x.id === stageId)!
  const left = pet.next ? pet.next.min - pet.checkDays : 0

  const tapEgg = () => {
    if (!ready || burst) return
    const n = taps + 1
    setTaps(n)
    setNudge((k) => k + 1)
    if (n < TAPS_TO_HATCH) return
    setBurst(true)
    timers.current.push(window.setTimeout(() => { setHatched(true); writeHatched(crewId); setPop(true) }, 420))
    timers.current.push(window.setTimeout(() => { setBurst(false); setPop(false) }, 1500))
  }

  const daysLeft = Math.max(0, HATCH_DAYS - pet.checkDays)
  const low = [...pet.needs].sort((a, b) => a.level - b.level)[0]
  const hint = ready
    ? taps === 0 ? 'Your egg is ready. Tap it three times to hatch it.' : taps < TAPS_TO_HATCH ? `It's cracking… ${TAPS_TO_HATCH - taps} more` : 'Here it comes!'
    : !hatched ? `Keep it warm: ${daysLeft} more daily check${daysLeft === 1 ? '' : 's'} and it hatches.`
      : low.level < 50 ? `${low.hungry}.` : 'Tap to give it a pat.'
  const pat = () => { setNudge((k) => k + 1); setHearts((k) => k + 1) }
  const cracks = hatched ? 0 : Math.min(3, Math.min(2, pet.checkDays) + taps)
  const trying = view === 'shop' && tryOn ? itemById(tryOn) : undefined
  const wear = hatched ? outfit(wardrobe, trying?.id) : undefined
  const points = balance(pet.xp, wardrobe)
  const art = <Pet stage={stageId} mood={pet.mood} name={name} size={220} cracks={cracks} ready={ready} burst={burst} pop={pop} nudge={nudge} hearts={hearts} wear={wear} />
  const show = (v: 'care' | 'shop') => { setView(v); setTryOn(null) }

  return (
    <div className="grid g2 pet-page">
      <div className="card pet-hero">
        <div className="card-h"><span className="ic"><PawPrint /></span><h3>Your crew pet</h3><span className="sub" title={`${pet.xp} earned in total`}>{points} care points</span></div>
        {ready
          ? <button type="button" className="pet-stage-big tappable" onClick={tapEgg} aria-label={`Tap to hatch (${TAPS_TO_HATCH - taps} taps left)`}>{art}</button>
          : hatched
            ? <button type="button" className="pet-stage-big tappable" onClick={pat} aria-label={`Give ${name} a pat`}>{art}</button>
            : <div className="pet-stage-big">{art}</div>}
        {hint && <p className={`pet-hint${ready ? ' ready' : ''}`}>{hint}</p>}
        {!hatched && !ready && (
          <>
            <div className="progress incubation" role="progressbar" aria-label="Incubation" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pet.incubation * 100)}>
              <span style={{ width: `${Math.round(pet.incubation * 100)}%` }} />
            </div>
            {!pet.tasks.find((t) => t.id === 'check')?.done && <button className="btn primary" onClick={() => go('check')}>Start today’s check</button>}
          </>
        )}
        <PetName name={name} onSave={(n) => { setName(n); writeName(crewId, n) }} />
        <div className="pet-tags">
          <span className="pill">{stage.name}</span>
          {hatched && <span className={`pet-mood m-${pet.mood}`}>{MOOD_LABEL[pet.mood]}</span>}
          {trying && <span className="pill shop-trying">Trying on: {trying.name}</span>}
        </div>
        {hatched && (
          <div className="seg pet-views" role="group" aria-label="Pet page view">
            <button className={view === 'care' ? 'on' : ''} aria-pressed={view === 'care'} onClick={() => show('care')}><PawPrint /> Care</button>
            <button className={view === 'shop' ? 'on' : ''} aria-pressed={view === 'shop'} onClick={() => show('shop')}><ShoppingBag /> Shop</button>
          </div>
        )}
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
        {hatched && view === 'shop' ? (
          <PetShop name={name} stage={stageId} xp={pet.xp} wardrobe={wardrobe} update={updateWardrobe} selected={tryOn} onSelect={setTryOn} />
        ) : (<>
        {hatched && (
          <div className="card">
            <div className="card-h"><span className="ic"><Heart /></span><h3>How {name} is doing</h3></div>
            <div className="pet-needs">
              {pet.needs.map((n) => (
                <button key={n.id} type="button" className={`pet-need${n.level < 35 ? ' low' : ''}`} onClick={() => go(n.tab)} aria-label={`${n.label} ${n.level}%`}>
                  <span className="pet-need-l">{n.label}</span>
                  <span className="pet-need-bar"><span style={{ width: `${n.level}%` }} /></span>
                  <span className="pet-need-v mono">{n.level}%</span>
                </button>
              ))}
            </div>
            <p className="pet-foot-note"><small>Needs run down over hours, like a Tamagotchi. Meals refill Fed, exercise or a pain report refills Exercised, and your daily check refills Checked in. Low needs make it hungry or sleepy, never ill.</small></p>
          </div>
        )}
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
                  <span className="pet-rung-t"><b>{st.name}</b><small>{st.id === 'egg' ? 'Day 1' : st.id === 'hatchling' ? `Hatches at ${st.min} checks` : `${st.min} check days`}</small></span>
                  {!reached && <Lock size={14} className="muted" />}
                </div>
              )
            })}
          </div>
          <p className="pet-foot-note"><small>It grows when you show up: daily check +{XP.check}, exercise +{XP.move}, log food +{XP.eat}, pain report +{XP.pain}. Your results never change it, and missed days only make it sleepy.</small></p>
        </div>
        </>)}
      </div>
    </div>
  )
}
