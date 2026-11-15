// Today's plan: what to do (rules + reasons), the exercise plan for this phase, and food.
import { useMemo, useState } from 'react'
import { ArrowRight, Check, Droplets, Dumbbell, Pill, Plus, Salad, Sparkles, Trash2 } from 'lucide-react'
import { activeProfile, addFood, addWorkout, dayKey, removeFood, removeWorkout, uid, useStore } from '../data/store'
import { exercisePlan, latestMass, recommendations, type Area } from '../engine/plan'
import { add, DEFAULT_TARGETS, goals, PANTRY, suggest, zero } from '../content/nutrition'
import { EvidenceChips } from '../components/ui'

const AREA: Record<Area, { label: string; color: string }> = {
  medical: { label: 'Medical', color: 'var(--act)' }, check: { label: 'Check-in', color: 'var(--violet-text)' },
  sleep: { label: 'Sleep', color: 'var(--baseline)' }, fluid: { label: 'Fluids', color: 'var(--chart-line)' },
  exercise: { label: 'Exercise', color: 'var(--usual)' }, nutrition: { label: 'Food', color: 'var(--watch)' },
  balance: { label: 'Balance', color: 'var(--teal-text)' }, recovery: { label: 'Recovery', color: 'var(--watch)' },
}

function Nutrient({ label, value, goal, unit, max = false }: { label: string; value: number; goal: number; unit: string; max?: boolean }) {
  const pct = Math.round((value / Math.max(1, goal)) * 100)
  const w = Math.min(100, pct)
  const over = max && value > goal
  const color = max ? (over ? 'var(--act)' : 'var(--usual)') : pct >= 90 ? 'var(--usual)' : pct >= 40 ? 'var(--watch)' : 'var(--violet)'
  return (
    <div className="nutrient">
      <div className="row between" style={{ gap: 6 }}>
        <span className="n-label">{label}</span>
        <span className="n-val"><b>{Math.round(value).toLocaleString()}</b> / {goal.toLocaleString()} {unit}{max ? ' max' : ''}{over ? ' · over' : ''}</span>
      </div>
      <div className="n-bar"><span style={{ width: `${Math.max(w, value > 0 ? 3 : 0)}%`, background: color }} /></div>
    </div>
  )
}

export function Plan({ go }: { go: (t: string) => void }) {
  const s = useStore()
  const p = activeProfile(s)
  const [pick, setPick] = useState(PANTRY[0].id)
  const [showLog, setShowLog] = useState(false)
  const today = dayKey(new Date())
  const log = useMemo(() => (p ? s.food.filter((f) => f.crewId === p.id && dayKey(f.ts) === today) : []), [s.food, p, today])
  if (!p) return null
  const recs = recommendations(s, p)
  const ex = exercisePlan(s, p)
  const toggleDone = (itemId: string) => {
    const mine = s.workouts.find((w) => w.crewId === p.id && w.exercise === `plan:${itemId}` && dayKey(w.ts) === dayKey(new Date()))
    if (mine) removeWorkout(mine.id)
    else addWorkout({ id: uid(), crewId: p.id, ts: new Date().toISOString(), exercise: `plan:${itemId}`, reps: 0, formScore: 100, faults: {}, source: 'manual' })
  }
  const mass = latestMass(s, p.id) ?? p.massKg ?? 75
  const g = goals(mass, { ...DEFAULT_TARGETS, ...p.targets })
  const eaten = log.reduce((acc, f) => add(acc, PANTRY.find((x) => x.id === f.itemId)?.n ?? zero(), f.servings), zero())
  const ideas = suggest(eaten, g)
  const eat = (itemId: string) => addFood({ id: uid(), crewId: p.id, ts: new Date().toISOString(), itemId, servings: 1 })
  const done = ex.items.filter((i) => i.done).length

  return (
    <div className="stack">
      <div className="card">
        <div className="card-h"><span className="ic"><Sparkles /></span><h3>What to do today</h3><span className="sub">{recs.length ? `${recs.length} item${recs.length > 1 ? 's' : ''}` : 'All clear'}</span></div>
        {recs.length === 0 && <p className="muted">Nothing extra today. Follow the exercise and food plan below.</p>}
        <div className="todo">
          {recs.map((r) => (
            <div key={r.id} className="todo-row">
              <span className="todo-tag" style={{ color: AREA[r.area].color, background: `color-mix(in srgb, ${AREA[r.area].color} 12%, transparent)` }}>{AREA[r.area].label}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{r.title}</b>
                <p className="muted" style={{ margin: '2px 0 0', fontSize: '.9rem' }}>{r.detail}</p>
                <details className="why-details"><summary>Why</summary><p>{r.because.join(' · ')}</p></details>
              </div>
              {r.action && <button className={`btn small${r.area === 'medical' ? ' danger' : r.area === 'check' ? ' primary' : ''}`} onClick={() => go(r.action!.tab)}>{r.action.label} <ArrowRight /></button>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-h"><span className="ic"><Dumbbell /></span><h3>Exercise</h3><span className="sub">{done}/{ex.items.filter((i) => !i.skip).length} done</span></div>
          <p className="muted" style={{ fontSize: '.92rem', marginTop: 0 }}>{ex.headline}</p>
          {ex.notes.map((n) => <div key={n} className="notice" style={{ marginTop: 8 }}>{n}</div>)}
          <div className="todo" style={{ marginTop: 10 }}>
            {ex.items.map((i) => (
              <div key={i.id} className="todo-row" style={{ opacity: i.skip ? 0.5 : 1 }}>
                <button type="button" className={`check-dot${i.done ? ' on' : ''}`} disabled={!!i.skip} aria-pressed={!!i.done}
                  aria-label={i.done ? `Mark ${i.label} as not done` : `Mark ${i.label} as done`} onClick={() => toggleDone(i.id)}>{i.done && <Check size={13} />}</button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{i.label}</b>
                  <p className="muted" style={{ margin: '2px 0 0', fontSize: '.88rem' }}>{i.skip ?? i.detail}</p>
                </div>
                <span className="mono muted" style={{ fontSize: '.78rem', whiteSpace: 'nowrap' }}>{i.minutes} min</span>
                {i.coach && !i.skip && <button className="btn small" onClick={() => go('coach')}>Coach</button>}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-h"><span className="ic"><Salad /></span><h3>Food today</h3><span className="sub">targets for {Math.round(mass)} kg</span></div>
          <div className="food-add">
            <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Food">
              {PANTRY.map((f) => <option key={f.id} value={f.id}>{f.name} — {f.serving}</option>)}
            </select>
            <button className="btn primary" onClick={() => eat(pick)}><Plus /> Add</button>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button className="btn small" onClick={() => eat('water')}><Droplets /> Water 250 mL</button>
            <button className="btn small" onClick={() => eat('vitd')} disabled={eaten.vitD >= g.vitD}><Pill /> {eaten.vitD >= g.vitD ? 'Vitamin D taken' : 'Vitamin D tablet'}</button>
          </div>

          <div className="nutrients">
            <Nutrient label="Energy" value={eaten.kcal} goal={g.kcal} unit="kcal" />
            <Nutrient label="Protein" value={eaten.protein} goal={g.protein} unit="g" />
            <Nutrient label="Calcium" value={eaten.calcium} goal={g.calcium} unit="mg" />
            <Nutrient label="Vitamin D" value={eaten.vitD} goal={g.vitD} unit="µg" />
            <Nutrient label="Potassium" value={eaten.potassium} goal={g.potassium} unit="mg" />
            <Nutrient label="Fluid" value={eaten.fluid} goal={g.fluid} unit="mL" />
            <Nutrient label="Sodium" value={eaten.sodium} goal={g.sodiumMax} unit="mg" max />
          </div>

          {ideas.length > 0 && (
            <div className="ideas">
              <p className="kicker" style={{ marginBottom: 6 }}>Suggested to close today’s gap</p>
              {ideas.map((f) => (
                <div key={f.id} className="idea">
                  <div style={{ flex: 1, minWidth: 0 }}><b>{f.name}</b><br /><small>+{Math.round(f.n.protein)} g protein · {f.n.kcal} kcal{f.n.calcium >= 150 ? ` · ${f.n.calcium} mg calcium` : ''}</small></div>
                  <button className="btn small" onClick={() => eat(f.id)}><Plus /> Add</button>
                </div>
              ))}
            </div>
          )}

          {log.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <button className="btn ghost small" onClick={() => setShowLog((v) => !v)}>{showLog ? 'Hide' : 'Show'} what I ate today ({log.length})</button>
              {showLog && (
                <table style={{ marginTop: 6 }}>
                  <tbody>{log.map((f) => {
                    const item = PANTRY.find((x) => x.id === f.itemId)
                    return <tr key={f.id}><td className="mono" style={{ width: 60 }}>{new Date(f.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td><td>{item?.name}</td><td className="num">{item?.n.kcal} kcal</td><td style={{ width: 40 }}><button className="btn ghost icon" title="Remove" onClick={() => removeFood(f.id)}><Trash2 /></button></td></tr>
                  })}</tbody>
                </table>
              )}
            </div>
          )}
          <p className="muted" style={{ fontSize: '.8rem', marginTop: 12 }}>Targets follow NASA's exploration nutrition requirements (JSC-67378) for your body mass. No sunlight on board, so vitamin D comes from a daily tablet. Food values are typical per serving, not from the flight food database.</p>
          <EvidenceChips ids={['nutrition', 'mass']} />
        </div>
      </div>
    </div>
  )
}
