import { useState } from 'react'
import { ArrowRight, Check, CheckCircle2, Circle, Dumbbell, HeartPulse, ListChecks, ScanFace, Sparkles, X } from 'lucide-react'
import { activeProfile, crewStatus, dayKey, history, useStore } from '../data/store'
import { recommendations } from '../engine/plan'
import { LEVEL_RANK, METRICS, worst, type Level } from '../engine/status'
import { plain, technical } from '../engine/describe'
import { PHASES } from '../content/mission'
import { PATTERN_LABEL } from '../engine/triage'
import { REGION_LABEL } from '../content/cards'
import { fmtNum, Spark, StatusChip } from '../components/ui'
import { SpaceWeatherCard } from '../components/SpaceWeatherCard'
import { PetCard } from '../components/Pet'

const GROUPS: { id: string; label: string }[] = [
  { id: 'face', label: 'Face scan' },
  { id: 'checkin', label: 'Mood & sleep' },
  { id: 'balance', label: 'Balance (measured with gravity)' },
  { id: 'body', label: 'Body' },
]
const seen = (k: string) => { try { return localStorage.getItem(`crew-mirror:seen:${k}`) === '1' } catch { return false } }
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' }

export function Today({ go }: { go: (tab: string) => void }) {
  const s = useStore()
  const p = activeProfile(s)
  const [hideStart, setHideStart] = useState(() => { try { return localStorage.getItem('crew-mirror:gs-hidden') === '1' } catch { return false } })
  if (!p) return null
  const st = crewStatus(s, p.id)
  const recs = recommendations(s, p)
  const phase = PHASES[p.phase]
  const today = dayKey(new Date())
  const checkDays = new Set(s.sessions.filter((x) => x.crewId === p.id && x.kind === 'daily').map((x) => dayKey(x.ts)))
  const todayDone = checkDays.has(today)
  const hasData = Object.keys(st).length > 0
  const attention = Object.entries(st).filter(([, r]) => r.level === 'act' || r.level === 'watch' || r.level === 'nodata')
    .sort((a, b) => LEVEL_RANK[b[1].level] - LEVEL_RANK[a[1].level])
  const overall: Level = hasData ? worst(Object.values(st).map((r) => r.level)) : 'baseline'
  const lastSymptom = s.symptoms.filter((x) => x.crewId === p.id).sort((a, b) => b.ts.localeCompare(a.ts))[0]
  const learning = Math.min(7, checkDays.size)

  const steps = [
    { done: true, label: 'Create your profile', tab: 'settings' },
    { done: checkDays.size > 0, label: 'Do your first daily check (2 min)', tab: 'check' },
    { done: seen('plan'), label: 'Open today’s exercise and food plan', tab: 'plan' },
    { done: seen('body'), label: 'Explore your 3D body', tab: 'body' },
    ...(p.phase === 'preflight' ? [{ done: s.sessions.some((x) => x.crewId === p.id && x.kind === 'balance'), label: 'Record a balance test before flight', tab: 'balance' }] : []),
    { done: checkDays.size >= 7, label: `Check in 7 days so the app learns your normal (${learning}/7)`, tab: 'check' },
  ]
  const showStart = !hideStart && !s.sample && steps.some((x) => !x.done)

  return (
    <div className="stack">
      <div className="grid g2">
        <div className="card">
          <p className="kicker">{new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h2 style={{ fontSize: '1.6rem', marginBottom: 2 }}>{greeting()}, {p.id}</h2>
          <p className="muted row" style={{ marginTop: 0, gap: 8 }}><span>{p.role}</span><span className="pill" style={{ padding: '1px 8px' }}>{phase.label}</span></p>
          {todayDone ? (
            <div className="notice ok" style={{ marginTop: 12 }}><Check size={15} style={{ verticalAlign: -3 }} /> Today’s check is done. See you tomorrow morning.</div>
          ) : (
            <button className="btn primary" style={{ marginTop: 14, padding: '12px 18px', fontSize: '1rem' }} onClick={() => go('check')}><ScanFace /> Start today’s check · 2 min</button>
          )}
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn small" onClick={() => go('report')}><HeartPulse /> Something hurts</button>
            <button className="btn small" onClick={() => go('coach')}><Dumbbell /> Exercise coach</button>
            {todayDone && <button className="btn small ghost" onClick={() => go('check')}>Check again</button>}
          </div>
        </div>

        <div className={`banner ${hasData ? overall : 'baseline'}`}>
          <div className="row between"><h2>How you’re doing</h2>{hasData && <StatusChip level={overall} />}</div>
          {(!hasData || overall === 'baseline') && (
            <>
              <p>{hasData ? <>Learning your normal: <b>day {learning} of 7</b>. Check in each morning.</> : 'No measurements yet. After 7 daily checks, the app can tell when something changes.'}</p>
              <div className="days7">
                {Array.from({ length: 7 }, (_, i) => <span key={i} className={i < learning ? 'on' : ''}><i>{i + 1}</i></span>)}
              </div>
              <small className="muted">{7 - learning > 0 ? `${7 - learning} more day${7 - learning > 1 ? 's' : ''} until your first results.` : 'Your results start tomorrow.'}</small>
            </>
          )}
          {hasData && attention.length === 0 && overall !== 'baseline' && <p>Everything is in your normal range.</p>}
          {attention.length > 0 && (
            <ul className="reasons">
              {attention.slice(0, 5).map(([id, r]) => (
                <li key={id}>
                  <StatusChip level={r.level} /> {plain(id, r)}
                  {r.level !== 'nodata' && <details className="why-details"><summary>How we know</summary><p>{technical(r)}</p></details>}
                </li>
              ))}
            </ul>
          )}
          {attention.some(([, r]) => r.level === 'act') && <p style={{ marginTop: 8 }}><b>Next step:</b> tell the crew medical officer today, and check again tomorrow morning.</p>}
          {lastSymptom && <p style={{ marginTop: 8 }}><small>Last pain report: {REGION_LABEL[lastSymptom.region]}, {PATTERN_LABEL[lastSymptom.result.pattern].toLowerCase()}, {new Date(lastSymptom.ts).toLocaleDateString()}.</small></p>}
        </div>
      </div>

      <div className="grid g2">
        <PetCard go={go} />
        {showStart && (
          <div className="card">
            <div className="card-h"><span className="ic"><ListChecks /></span><h3>Getting started</h3><span className="sub">{steps.filter((x) => x.done).length}/{steps.length}</span><button className="btn ghost icon" title="Hide" onClick={() => { setHideStart(true); try { localStorage.setItem('crew-mirror:gs-hidden', '1') } catch { /* ignore */ } }}><X /></button></div>
            <div className="stack" style={{ marginTop: 8 }}>
              {steps.map((x) => (
                <button key={x.label} className="problem" style={{ padding: 9, opacity: x.done ? 0.6 : 1 }} onClick={() => go(x.tab)}>
                  {x.done ? <CheckCircle2 size={18} style={{ color: 'var(--usual)' }} /> : <Circle size={18} style={{ color: 'var(--muted-fg)' }} />}
                  <span style={{ flex: 1, textDecoration: x.done ? 'line-through' : 'none' }}>{x.label}</span>
                  {!x.done && <ArrowRight size={15} />}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="card">
          <div className="card-h"><span className="ic"><Sparkles /></span><h3>Today’s plan</h3></div>
          {recs.slice(0, 4).map((r) => (
            <div key={r.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <b style={{ fontSize: '.95rem' }}>{r.title}</b><br /><small>{r.detail}</small>
            </div>
          ))}
          {recs.length === 0 && <p className="muted">Nothing extra today. Follow your exercise and food plan.</p>}
          <button className="btn violet small" style={{ marginTop: 10 }} onClick={() => go('plan')}>Exercise & food for today <ArrowRight /></button>
        </div>
      </div>

      {hasData && GROUPS.map((g) => {
        const ids = Object.keys(METRICS).filter((id) => METRICS[id].group === g.id && st[id])
        if (!ids.length) return null
        return (
          <div key={g.id}>
            <h3 style={{ marginTop: 8 }}>{g.label}</h3>
            <div className="grid g4">
              {ids.map((id) => {
                const r = st[id]
                const h = history(s.sessions, p.id, id).slice(-21)
                const latest = h[h.length - 1]
                return (
                  <button className="card tight tile lift" key={id} style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }} title={plain(id, r)} onClick={() => go('trends')}>
                    <div className="row between"><small>{METRICS[id].label}</small><StatusChip level={r.level} n={r.n} /></div>
                    <div className="val">{latest?.ok ? fmtNum(latest.value) : '—'} <small>{METRICS[id].unit}</small></div>
                    <Spark values={h.map((x) => (x.ok ? x.value : null))} median={r.median} scale={r.scale} />
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      <SpaceWeatherCard phase={p.phase} />
    </div>
  )
}
