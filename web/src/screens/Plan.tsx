// Today's plan: what to do (rules + reasons), the exercise plan for this phase, and food.
import { useState } from 'react'
import { ArrowRight, Check, Dumbbell, Plus, Salad, Sparkles, Trash2 } from 'lucide-react'
import { activeProfile, addFood, dayKey, removeFood, uid, useStore } from '../data/store'
import { exercisePlan, latestMass, recommendations, type Area } from '../engine/plan'
import { add, DEFAULT_TARGETS, goals, PANTRY, suggest, zero } from '../content/nutrition'
import { EvidenceChips } from '../components/ui'

const AREA: Record<Area, { label: string; color: string }> = {
  medical: { label: 'Medical', color: 'var(--act)' }, check: { label: 'Check', color: 'var(--violet-text)' },
  sleep: { label: 'Sleep', color: 'var(--baseline)' }, fluid: { label: 'Fluids', color: 'var(--chart-line)' },
  exercise: { label: 'Exercise', color: 'var(--usual)' }, nutrition: { label: 'Food', color: 'var(--watch)' },
  balance: { label: 'Balance', color: 'var(--teal-text)' }, recovery: { label: 'Recovery', color: 'var(--watch)' },
}

function Bar({ label, value, goal, unit, max = false }: { label: string; value: number; goal: number; unit: string; max?: boolean }) {
  const pct = Math.min(100, (value / Math.max(1, goal)) * 100)
  const over = max && value > goal
  const color = max ? (over ? 'var(--act)' : 'var(--usual)') : pct >= 90 ? 'var(--usual)' : pct >= 50 ? 'var(--watch)' : 'var(--act)'
  return (
    <div style={{ marginTop: 10 }}>
      <div className="row between"><small><b>{label}</b></small><small className="mono">{Math.round(value)} / {goal} {unit}{max ? ' max' : ''}</small></div>
      <div className="progress" style={{ height: 8 }}><span style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  )
}

export function Plan({ go }: { go: (t: string) => void }) {
  const s = useStore()
  const p = activeProfile(s)
  const [pick, setPick] = useState(PANTRY[0].id)
  if (!p) return null
  const recs = recommendations(s, p)
  const ex = exercisePlan(s, p)
  const mass = latestMass(s, p.id) ?? p.massKg ?? 75
  const g = goals(mass, { ...DEFAULT_TARGETS, ...p.targets })
  const today = dayKey(new Date())
  const log = s.food.filter((f) => f.crewId === p.id && dayKey(f.ts) === today)
  const eaten = log.reduce((acc, f) => add(acc, PANTRY.find((x) => x.id === f.itemId)?.n ?? zero(), f.servings), zero())
  const ideas = suggest(eaten, g)
  const eat = (itemId: string) => addFood({ id: uid(), crewId: p.id, ts: new Date().toISOString(), itemId, servings: 1 })

  return (
    <div className="stack">
      <div className="card">
        <p className="kicker"><Sparkles size={13} style={{ verticalAlign: -2 }} /> What to do today</p>
        {recs.length === 0 && <p className="muted">Nothing extra today — follow the exercise and food plan below.</p>}
        <div className="stack">
          {recs.map((r) => (
            <div key={r.id} className="problem" style={{ cursor: 'default' }}>
              <span className="chip" style={{ color: AREA[r.area].color, minWidth: 74, justifyContent: 'center' }}>{AREA[r.area].label}</span>
              <div style={{ flex: 1 }}>
                <b>{r.title}</b>
                <p style={{ margin: '2px 0', fontSize: '.9rem' }}>{r.detail}</p>
                <small className="muted">Because: {r.because.join(' · ')}</small>
              </div>
              {r.action && <button className="btn small" onClick={() => go(r.action!.tab)}>{r.action.label} <ArrowRight /></button>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <p className="kicker"><Dumbbell size={13} style={{ verticalAlign: -2 }} /> Exercise plan</p>
          <p style={{ fontSize: '.92rem' }}>{ex.headline}</p>
          {ex.notes.map((n) => <div key={n} className="notice" style={{ marginTop: 6 }}>{n}</div>)}
          <div className="stack" style={{ marginTop: 10 }}>
            {ex.items.map((i) => (
              <div key={i.id} className="ex" style={{ opacity: i.skip ? 0.55 : 1 }}>
                <div className="row between">
                  <b>{i.done && <Check size={15} style={{ color: 'var(--usual)', verticalAlign: -2 }} />} {i.label}</b>
                  <span className="mono" style={{ fontSize: '.78rem' }}>{i.minutes} min</span>
                </div>
                <small>{i.skip ?? i.detail}</small>
                {i.coach && !i.skip && <div style={{ marginTop: 6 }}><button className="btn small violet" onClick={() => go('coach')}>Camera coach</button></div>}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <p className="kicker"><Salad size={13} style={{ verticalAlign: -2 }} /> Food today · targets for {Math.round(mass)} kg</p>
          <Bar label="Energy" value={eaten.kcal} goal={g.kcal} unit="kcal" />
          <Bar label="Protein" value={eaten.protein} goal={g.protein} unit="g" />
          <Bar label="Calcium" value={eaten.calcium} goal={g.calcium} unit="mg" />
          <Bar label="Vitamin D" value={eaten.vitD} goal={g.vitD} unit="µg" />
          <Bar label="Potassium" value={eaten.potassium} goal={g.potassium} unit="mg" />
          <Bar label="Fluid" value={eaten.fluid} goal={g.fluid} unit="mL" />
          <Bar label="Sodium" value={eaten.sodium} goal={g.sodiumMax} unit="mg" max />
          <div className="row" style={{ marginTop: 14 }}>
            <select value={pick} onChange={(e) => setPick(e.target.value)} style={{ flex: 1, minWidth: 180 }}>
              {PANTRY.map((f) => <option key={f.id} value={f.id}>{f.name} · {f.serving}</option>)}
            </select>
            <button className="btn primary small" onClick={() => eat(pick)}><Plus /> Log</button>
            <button className="btn small" onClick={() => eat('water')}>+ 250 mL water</button>
          </div>
          {ideas.length > 0 && (
            <div className="notice" style={{ marginTop: 12 }}>
              <b>To close today’s gap:</b> {ideas.map((f, i) => (
                <span key={f.id}>{i ? ', ' : ' '}<button className="btn small" style={{ margin: '3px 2px' }} onClick={() => eat(f.id)}>{f.name} (+{Math.round(f.n.protein)} g protein)</button></span>
              ))}
            </div>
          )}
          {eaten.vitD < g.vitD && <p style={{ fontSize: '.88rem' }}>No sunlight on board — take the daily vitamin D tablet. <button className="btn small" onClick={() => eat('vitd')}>Log tablet</button></p>}
          {log.length > 0 && (
            <table style={{ marginTop: 10 }}>
              <tbody>{log.map((f) => {
                const item = PANTRY.find((x) => x.id === f.itemId)
                return <tr key={f.id}><td>{new Date(f.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td><td>{item?.name}</td><td className="num">{item?.n.protein} g</td><td><button className="btn ghost icon" title="Remove" onClick={() => removeFood(f.id)}><Trash2 /></button></td></tr>
              })}</tbody>
            </table>
          )}
          <small className="muted">Targets are defaults (35 kcal/kg, protein 1.2 g/kg, calcium 1000 mg, vitamin D 20 µg, sodium ≤ 2300 mg, potassium 3500 mg, fluid 2.5 L) for the crew nutritionist to adjust in Settings. Food values are approximate.</small>
          <EvidenceChips ids={['nutrition', 'mass']} />
        </div>
      </div>
    </div>
  )
}
