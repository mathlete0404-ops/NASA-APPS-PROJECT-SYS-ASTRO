// Calendar: day by day — checks (coloured by that day's status), pain
// reports, balance tests, workouts, and mission events (EVA, landing, medical conference).
import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Flame, Plus, Trash2 } from 'lucide-react'
import { activeProfile, addEvent, dayKey, history, removeEvent, uid, useStore } from '../data/store'
import { METRICS, metricStatus, worst, type Level } from '../engine/status'
import { PATTERN_LABEL } from '../engine/triage'
import { REGION_LABEL } from '../content/cards'
import { COACH, type CoachExercise } from '../engine/coach'
import type { CalendarEvent } from '../data/types'
import { EmptyState, StatusChip } from '../components/ui'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const KIND_LABEL: Record<CalendarEvent['kind'], string> = { note: 'Note', eva: 'EVA', exercise: 'Exercise', landing: 'Landing / arrival', medical: 'Medical', other: 'Mission event' }

export function CalendarPage({ go }: { go: (t: string) => void }) {
  const s = useStore()
  const p = activeProfile(s)
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [sel, setSel] = useState(dayKey(new Date()))
  const [kind, setKind] = useState<CalendarEvent['kind']>('note')
  const [title, setTitle] = useState('')

  // Status of each day's check = worst metric status using history up to that day.
  const dayLevel = useMemo(() => {
    const m = new Map<string, Level>()
    if (!p) return m
    const days = new Set(s.sessions.filter((x) => x.crewId === p.id && x.kind === 'daily').map((x) => dayKey(x.ts)))
    const hist = Object.keys(METRICS).map((id) => [id, history(s.sessions, p.id, id)] as const)
    for (const d of days) {
      const lv: Level[] = []
      for (const [id, h] of hist) {
        const upTo = h.filter((x) => dayKey(x.ts) <= d)
        if (upTo.length && dayKey(upTo[upTo.length - 1].ts) === d) lv.push(metricStatus(id, upTo.map((x) => [x.value, x.ok])).level)
      }
      m.set(d, lv.length ? worst(lv) : 'nodata')
    }
    return m
  }, [s.sessions, p])
  if (!p) return null

  const mine = <T extends { crewId: string }>(xs: T[]) => xs.filter((x) => x.crewId === p.id)
  const sym = mine(s.symptoms), bal = mine(s.sessions).filter((x) => x.kind === 'balance'), wo = mine(s.workouts)
  const evs = s.events.filter((e) => e.crewId === p.id || e.crewId === 'ALL')
  const on = <T,>(xs: T[], ts: (x: T) => string, d: string) => xs.filter((x) => dayKey(ts(x)) === d)

  // grid: Monday-first weeks covering the month
  const first = new Date(month)
  const offset = (first.getDay() + 6) % 7
  const start = new Date(first); start.setDate(1 - offset)
  const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
  const today = dayKey(new Date())

  let streak = 0
  for (let d = new Date(); ; d.setDate(d.getDate() - 1)) { if (dayLevel.has(dayKey(d))) streak++; else if (dayKey(d) !== today) break; else continue; if (streak > 400) break }
  const upcoming = evs.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5)

  const selDate = new Date(sel + 'T12:00:00')
  const dSym = on(sym, (x) => x.ts, sel), dBal = on(bal, (x) => x.ts, sel), dWo = on(wo, (x) => x.ts, sel), dEv = evs.filter((e) => e.date === sel)
  const lvl = dayLevel.get(sel)
  const empty = !dayLevel.size && !sym.length && !bal.length && !wo.length && !evs.length

  return (
    <div className="stack">
      {empty && (
        <EmptyState icon={CalendarDays} title="Nothing on your calendar yet" action="Start today’s check" onAction={() => go('check')}>
          Each daily check appears on its day, coloured by how it went, along with pain reports, balance tests, workouts and events you add (EVA, medical conference, landing). Pick a day below to add an event.
        </EmptyState>
      )}
      <div className="split-3d cal-split">
        <div className="card">
          <div className="row between" style={{ marginBottom: 10 }}>
            <div className="row">
              <button className="btn icon small" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} title="Previous month"><ChevronLeft /></button>
              <h2 style={{ margin: 0, minWidth: 170, textAlign: 'center' }}>{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</h2>
              <button className="btn icon small" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} title="Next month"><ChevronRight /></button>
              <button className="btn small" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setSel(today) }}>Today</button>
            </div>
            <span className="pill"><Flame size={14} style={{ color: 'var(--watch)' }} /> {streak > 0 ? `${streak}-day check streak` : 'Check in today to start a streak'}</span>
          </div>
          <div className="cal">
            {DOW.map((d) => <div key={d} className="dow">{d}</div>)}
            {cells.map((d) => {
              const k = dayKey(d)
              const l = dayLevel.get(k)
              const nSym = on(sym, (x) => x.ts, k).length, nBal = on(bal, (x) => x.ts, k).length, nWo = on(wo, (x) => x.ts, k).length
              const e = evs.filter((x) => x.date === k)
              return (
                <button key={k} className={`day${d.getMonth() !== month.getMonth() ? ' out' : ''}${k === today ? ' today' : ''}${k === sel ? ' sel' : ''}`} onClick={() => setSel(k)}>
                  <span className="num"><span>{d.getDate()}</span><span>{k === today ? 'today' : ''}</span></span>
                  {l && <span className={`tag check ${l}`}>Check · {l === 'nodata' ? 'No data' : l}</span>}
                  {nSym > 0 && <span className="tag pain">Pain ×{nSym}</span>}
                  {nBal > 0 && <span className="tag bal">Balance</span>}
                  {nWo > 0 && <span className="tag check">Workout ×{nWo}</span>}
                  {e.map((x) => <span key={x.id} className="tag ev" title={x.title}>{x.title}</span>)}
                </button>
              )
            })}
          </div>
          <div className="legend" style={{ marginTop: 10 }}>
            <span><i style={{ background: 'var(--usual)' }} />Check usual</span><span><i style={{ background: 'var(--watch)' }} />Watch</span>
            <span><i style={{ background: 'var(--act)' }} />Act / pain</span><span><i style={{ background: 'var(--baseline)' }} />Balance</span><span><i style={{ background: 'var(--violet)' }} />Event</span>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <p className="kicker">{selDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</p>
            {lvl ? <p>Daily check: <StatusChip level={lvl} /></p> : <p className="muted">No daily check this day.{sel === today && <> <button className="btn small" onClick={() => go('check')}>Do it now</button></>}</p>}
            {dSym.map((x) => <p key={x.id} style={{ fontSize: '.9rem' }}>🩹 <b>{REGION_LABEL[x.region]}</b> {x.kind} {x.intensity}/10 — {PATTERN_LABEL[x.result.pattern]}{x.source ? ` · source: ${x.source.label}` : ''}</p>)}
            {dBal.map((x) => <p key={x.id} style={{ fontSize: '.9rem' }}>⚖️ Balance: {x.measurements.map((m) => `${METRICS[m.metric]?.label ?? m.metric} ${m.ok ? m.value : 'No data'}`).join(', ')}</p>)}
            {dWo.map((x) => <p key={x.id} style={{ fontSize: '.9rem' }}>🏋️ {COACH[x.exercise as CoachExercise]?.name ?? x.exercise}: {x.reps} reps, form {x.formScore}%</p>)}
            {dEv.map((x) => (
              <div key={x.id} className="row between" style={{ fontSize: '.9rem' }}>
                <span>📌 <b>{KIND_LABEL[x.kind]}</b> · {x.title}</span>
                {x.crewId === p.id && <button className="btn ghost icon" title="Remove" onClick={() => removeEvent(x.id)}><Trash2 /></button>}
              </div>
            ))}
            <div className="field">
              <label htmlFor="evt">Add to this day</label>
              <div className="row">
                <select value={kind} onChange={(e) => setKind(e.target.value as CalendarEvent['kind'])}>{(Object.keys(KIND_LABEL) as CalendarEvent['kind'][]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
                <input id="evt" type="text" value={title} placeholder="e.g. EVA 3, rest day, video call" onChange={(e) => setTitle(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
                <button className="btn primary small" disabled={!title.trim()} onClick={() => { addEvent({ id: uid(), crewId: p.id, date: sel, kind, title: title.trim() }); setTitle('') }}><Plus /> Add</button>
              </div>
            </div>
          </div>
          <div className="card">
            <p className="kicker">Coming up</p>
            {upcoming.length === 0 ? <p className="muted">No upcoming events.</p> : upcoming.map((e) => (
              <div key={e.id} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span><b>{e.title}</b><br /><small>{KIND_LABEL[e.kind]} · {new Date(e.date + 'T12:00:00').toLocaleDateString()}</small></span>
                <small className="mono">in {Math.round((Date.parse(e.date) - Date.parse(today)) / 86_400_000)} d</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
