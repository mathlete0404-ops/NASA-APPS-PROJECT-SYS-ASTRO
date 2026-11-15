// Emergency: who needs help, quick yes/no questions, and step-by-step guides for the helper,
// with a T+ clock, timers (including a CPR beat), camera heart rate, crew roll call and a timed
// log that can be queued to Earth with the real signal delay. Example procedures only.
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, ChevronLeft, HeartPulse, Send, Siren, Undo2, Volume2, VolumeX } from 'lucide-react'
import { activeProfile, addDownlink, crewStatus, history, uid, useStore } from '../data/store'
import { GUIDE, GUIDES, TRIAGE_QUESTIONS, type Guide, type GuideId, type Step } from '../content/emergency'
import { crewAlerts, openAlerts, type CrewAlert } from '../engine/emergency'
import { LIGHT_DELAY } from '../content/mission'
import { FaceScan } from './DailyCheck'
import { StatusChip } from '../components/ui'
import type { Level } from '../engine/status'

// ---------------------------------------------------------------- alerts (shared with the app shell)
const ACK_KEY = 'crew-mirror:sos-ack'
export const readAcks = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(ACK_KEY) ?? '{}') } catch { return {} } }
export const ackAlert = (crewId: string) => { try { localStorage.setItem(ACK_KEY, JSON.stringify({ ...readAcks(), [crewId]: new Date().toISOString() })) } catch { /* ignore */ } }

export function useCrewAlerts(): CrewAlert[] {
  const s = useStore()
  const [tick, setTick] = useState(0)
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 60000); const on = () => setTick((x) => x + 1); addEventListener('crew-mirror:ack', on); return () => { clearInterval(t); removeEventListener('crew-mirror:ack', on) } }, [])
  return useMemo(() => {
    void tick
    const all = crewAlerts(s.crew.map((c) => c.id), s.symptoms, (id) => crewStatus(s, id), (id, m) => { const h = history(s.sessions, id, m); return h[h.length - 1]?.ts })
    return openAlerts(all, readAcks())
  }, [s, tick])
}

const timeOf = (ts: string) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/** Red banner on every app screen while someone may need help. */
export function CrewAlertBanner({ go }: { go: (t: string) => void }) {
  const alerts = useCrewAlerts()
  const a = alerts[0]
  if (!a) return null
  return (
    <div className="sos-banner" role="alert">
      <Siren />
      <div className="sos-banner-t"><b>{a.crewId} may need help</b><span>{a.reason} · {timeOf(a.ts)}{alerts.length > 1 ? ` · +${alerts.length - 1} more` : ''}</span></div>
      <button className="btn small sos-open" onClick={() => go(a.guide ? `sos/${a.guide}` : 'sos')}>Open guide <ArrowRight /></button>
      <button className="btn small ghost sos-ack" onClick={() => { ackAlert(a.crewId); dispatchEvent(new Event('crew-mirror:ack')) }}>Help is on the way</button>
    </div>
  )
}

// ---------------------------------------------------------------- page
export function Emergency({ go }: { go: (t: string) => void }) {
  const s = useStore()
  const p = activeProfile(s)
  const alerts = useCrewAlerts()
  const fromHash = () => { const g = location.hash.replace(/^#\/?/, '').split('/')[2]; return g && g in GUIDE ? (g as GuideId) : null }
  const [guide, setGuide] = useState<GuideId | null>(fromHash)
  const [patient, setPatient] = useState<string>(() => alerts[0]?.crewId ?? p?.id ?? '')
  const [q, setQ] = useState(0)
  useEffect(() => { const on = () => setGuide(fromHash()); addEventListener('hashchange', on); return () => removeEventListener('hashchange', on) }, [])
  if (!p) return null
  const levelOf = (id: string): Level => {
    const st = Object.values(crewStatus(s, id)).map((r) => r.level)
    return alerts.some((a) => a.crewId === id) ? 'act' : st.includes('act') ? 'act' : st.includes('watch') ? 'watch' : st.length ? 'usual' : 'baseline'
  }
  const start = (id: GuideId) => { setGuide(id); history_push(id) }
  const history_push = (id: GuideId | null) => { location.hash = id ? `/app/sos/${id}` : '/app/sos' }

  if (guide) return <GuideRunner key={guide + patient} guide={GUIDE[guide]} patientId={patient || p.id} responderId={p.id} onExit={() => { setGuide(null); history_push(null) }} onSwitch={start} go={go} />

  return (
    <div className="stack sos-page">
      <div className="sos-intro">
        <Siren /><div><b>Emergency guides</b><p>Pick who needs help, answer yes or no, then follow one step at a time. Example procedures that support, never replace, your onboard checklist and the crew medical officer.</p></div>
      </div>

      {alerts.length > 0 && (
        <div className="card sos-alerts">
          <h3 style={{ marginTop: 0 }}>Needs help now</h3>
          {alerts.map((a) => (
            <div key={a.crewId} className="sos-alert-row">
              <span className="chip act">Act</span>
              <span style={{ flex: 1 }}><b>{a.crewId}</b> · {a.reason} · {timeOf(a.ts)}</span>
              <button className="btn danger small" onClick={() => { setPatient(a.crewId); ackAlert(a.crewId); start(a.guide ?? 'chest') }}>Help now</button>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Who needs help?</h3>
        <div className="sos-crew">
          {s.crew.map((c) => (
            <button key={c.id} className={`sos-person${patient === c.id ? ' on' : ''}`} onClick={() => setPatient(c.id)} aria-pressed={patient === c.id}>
              <b>{c.id}{c.id === p.id ? ' (me)' : ''}</b><small>{c.role}</small><StatusChip level={levelOf(c.id)} />
            </button>
          ))}
        </div>
      </div>

      <div className="grid g2 sos-grid">
        <div className="card sos-ask">
          <p className="kicker" style={{ color: 'var(--act)' }}>Not sure what is happening? Start here</p>
          {q < TRIAGE_QUESTIONS.length ? (
            <>
              <small className="muted">Question {q + 1} of {TRIAGE_QUESTIONS.length} · most dangerous first</small>
              <h2 className="sos-q">{TRIAGE_QUESTIONS[q].q}</h2>
              <div className="row">
                <button className="btn danger sos-yes" onClick={() => start(TRIAGE_QUESTIONS[q].guide)}>Yes</button>
                <button className="btn" onClick={() => setQ(q + 1)}>No</button>
              </div>
            </>
          ) : (
            <>
              <h2 className="sos-q">No emergency guide fits.</h2>
              <p className="muted">Use <b>Something hurts</b> for a full check, or tell the crew medical officer.</p>
              <div className="row"><button className="btn" onClick={() => go('report')}>Something hurts</button><button className="btn ghost" onClick={() => setQ(0)}>Start again</button></div>
            </>
          )}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>I know what is happening</h3>
          <div className="sos-list">
            {GUIDES.map((g) => (
              <button key={g.id} className={`sos-guide ${g.severity === 'Life-threatening' ? 'lt' : 'se'}`} onClick={() => start(g.id)}>
                <small>{g.severity} · {g.steps.length} steps</small><b>{g.title}</b><span>{g.when}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- guide runner
interface LogLine { t: number; text: string }
const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

function GuideRunner({ guide, patientId, responderId, onExit, onSwitch, go }: { guide: Guide; patientId: string; responderId: string; onExit: () => void; onSwitch: (g: GuideId) => void; go: (t: string) => void }) {
  const s = useStore()
  const t0 = useRef(Date.now())
  const [now, setNow] = useState(Date.now())
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<Record<number, boolean>>({})
  const [log, setLog] = useState<LogLine[]>([{ t: 0, text: `Started “${guide.title}”. Patient: ${patientId}. Responder: ${responderId}.` }])
  const [route, setRoute] = useState('mars-mid')
  const [sent, setSent] = useState<string | null>(null)
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t) }, [])
  const el = (now - t0.current) / 1000
  const add = (text: string) => setLog((l) => [...l, { t: (Date.now() - t0.current) / 1000, text }])
  const step = guide.steps[i]
  const next = (note?: string) => { add(note ?? `Done: ${step.title}`); setI((k) => Math.min(guide.steps.length - 1, k + 1)) }
  const undo = () => { if (i > 0) { setI(i - 1); add(`Went back to step ${i}.`) } }
  const delay = LIGHT_DELAY.find((d) => d.id === route)!
  const send = () => {
    const body = [`EMERGENCY LOG · ${guide.title}`, `Patient ${patientId} · responder ${responderId}`, ...log.map((l) => `T+${mmss(l.t)} ${l.text}`)].join('\n')
    addDownlink({ id: uid(), crewId: patientId, body, sentAt: Date.now(), deliverAt: Date.now() + delay.s * 1000, delayS: delay.s, route: delay.label })
    add(`Log sent to Earth (${delay.label}, arrives in ${Math.round(delay.s / 60) || 1} min).`)
    setSent(delay.label)
  }
  const last = i === guide.steps.length - 1
  return (
    <div className="sos-run">
      <div className={`sos-head ${guide.severity === 'Life-threatening' ? 'lt' : 'se'}`}>
        <button className="btn ghost icon sos-back" onClick={onExit} title="Back to the guide list" aria-label="Back to the guide list"><ChevronLeft /></button>
        <div className="sos-head-t"><b>{guide.title}</b><span>Patient {patientId} · {guide.severity}</span></div>
        <span className="sos-clock mono" aria-label={`Elapsed ${mmss(el)}`}>T+{mmss(el)}</span>
      </div>
      <div className="sos-body">
        <ol className="sos-steps" aria-label="Steps">
          {guide.steps.map((st, k) => <li key={k} className={k === i ? 'on' : k < i ? 'done' : ''}><button onClick={() => setI(k)}>{k < i ? <Check size={14} /> : <span>{k + 1}</span>}{st.title}</button></li>)}
        </ol>
        <div className="card sos-step">
          <p className="kicker">Step {i + 1} of {guide.steps.length}</p>
          <h2>{step.title}</h2>
          {step.body && <p className="sos-step-body">{step.body}</p>}
          <StepAction step={step} key={i} answer={answers[i]} onAnswer={(v) => { setAnswers({ ...answers, [i]: v }); add(`${step.title} → ${v ? 'Yes' : 'No'}`) }} add={add} patientId={patientId} />
          <div className="row sos-nav">
            {!last ? <button className="btn danger sos-next" onClick={() => next()}>Done, next step <ArrowRight /></button>
              : <button className="btn primary" onClick={() => { add('Guide finished.'); onExit() }}>Finish guide</button>}
            <button className="btn ghost small" onClick={undo} disabled={i === 0}><Undo2 /> Back a step</button>
            {guide.escalate && <button className="btn small sos-esc" onClick={() => { add(`Switched to “${GUIDE[guide.escalate!.to].title}”: ${guide.escalate!.label}.`); onSwitch(guide.escalate!.to) }}><Siren /> {guide.escalate.label}</button>}
          </div>
          <p className="muted sos-disc">Example procedure for a prototype. Follow your onboard checklist and the crew medical officer first.</p>
        </div>
        <div className="card sos-log">
          <h3 style={{ marginTop: 0 }}>Event log</h3>
          <ol>{log.map((l, k) => <li key={k}><span className="mono">T+{mmss(l.t)}</span> {l.text}</li>)}</ol>
          <label className="stack" style={{ gap: 4 }}><small className="muted">Distance to Earth</small>
            <select value={route} onChange={(e) => setRoute(e.target.value)}>{LIGHT_DELAY.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select>
          </label>
          <button className="btn" onClick={send}><Send /> Send log to Earth</button>
          {sent && <small className="muted">Queued: {sent}. See it arrive in the <a href="#/app/medical" onClick={(e) => { e.preventDefault(); go('medical') }}>medical officer view</a>.</small>}
          <small className="muted">{s.crew.length} crew on board · sources: {guide.sources.map((x, k) => <a key={k} href={x.url} target="_blank" rel="noreferrer">{x.label}{k < guide.sources.length - 1 ? ', ' : ''}</a>)}</small>
        </div>
      </div>
    </div>
  )
}

function StepAction({ step, answer, onAnswer, add, patientId }: { step: Step; answer?: boolean; onAnswer: (v: boolean) => void; add: (t: string) => void; patientId: string }) {
  const s = useStore()
  if (step.kind === 'ask') return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row"><button className={`btn${answer === true ? ' danger' : ''}`} onClick={() => onAnswer(true)}>Yes</button><button className={`btn${answer === false ? ' primary' : ''}`} onClick={() => onAnswer(false)}>No</button></div>
      {answer === true && step.alert && <div className="notice err">{step.alert}</div>}
    </div>
  )
  if (step.kind === 'timer') return <StepTimer seconds={step.seconds} cpr={!!step.cpr} add={add} />
  if (step.kind === 'measure') return <MeasureHR add={add} />
  if (step.kind === 'mark') return <MarkTime label={step.label} add={add} />
  if (step.kind === 'crew') return <RollCall crew={s.crew.map((c) => c.id)} add={add} patientId={patientId} />
  return null
}

function MarkTime({ label, add }: { label: string; add: (t: string) => void }) {
  const [at, setAt] = useState<string | null>(null)
  return <div className="row"><button className="btn" onClick={() => { const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); setAt(t); add(`${label}: ${t}`) }}>{at ? `Marked ${at}` : `Mark “${label}” now`}</button></div>
}

function RollCall({ crew, add }: { crew: string[]; add: (t: string) => void; patientId: string }) {
  const [ok, setOk] = useState<Set<string>>(new Set())
  const toggle = (id: string) => { const n = new Set(ok); if (n.has(id)) n.delete(id); else { n.add(id); add(`${id} accounted for.`) } setOk(n); if (n.size === crew.length && !ok.has(id)) add('All crew accounted for.') }
  return <div className="sos-roll">{crew.map((id) => <button key={id} className={`btn small${ok.has(id) ? ' primary' : ''}`} onClick={() => toggle(id)}>{ok.has(id) ? <Check /> : null}{id}</button>)}<small className="muted">{ok.size}/{crew.length} accounted for</small></div>
}

function StepTimer({ seconds, cpr, add }: { seconds: number; cpr: boolean; add: (t: string) => void }) {
  const [startAt, setStartAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const [sound, setSound] = useState(cpr)
  const [round, setRound] = useState(1)
  const ac = useRef<AudioContext | null>(null)
  const lastBeat = useRef(0)
  useEffect(() => {
    if (startAt == null) return
    const t = setInterval(() => {
      const n = Date.now(); setNow(n)
      if (cpr && sound) {
        const beat = Math.floor((n - startAt) / (60000 / 110))
        if (beat !== lastBeat.current) {
          lastBeat.current = beat
          try {
            ac.current ??= new AudioContext()
            const o = ac.current.createOscillator(), g = ac.current.createGain()
            o.frequency.value = beat % 30 === 0 ? 1320 : 880; g.gain.value = 0.12
            o.connect(g).connect(ac.current.destination); o.start(); o.stop(ac.current.currentTime + 0.05)
          } catch { /* no audio */ }
        }
      }
    }, 25)
    return () => clearInterval(t)
  }, [startAt, cpr, sound])
  useEffect(() => () => { void ac.current?.close() }, [])
  const left = startAt == null ? seconds : Math.max(0, seconds - (now - startAt) / 1000)
  const done = startAt != null && left === 0
  useEffect(() => { if (done) add(cpr ? `2 minutes of compressions (round ${round}): swap rescuers.` : 'Timer finished.') }, [done]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`sos-timer${cpr && startAt != null && !done ? ' beating' : ''}`}>
      <div className="sos-timer-n mono">{mmss(Math.ceil(left))}</div>
      {cpr && <div className="sos-beat" aria-hidden="true" />}
      <div className="row">
        {startAt == null && <button className="btn danger" onClick={() => { setStartAt(Date.now()); add(cpr ? 'Compressions started (110 per minute).' : `Timer started (${mmss(seconds)}).`) }}><HeartPulse /> {cpr ? 'Start compressions' : 'Start timer'}</button>}
        {done && cpr && <><b className="sos-swap">Swap rescuers now</b><button className="btn danger" onClick={() => { setRound(round + 1); setStartAt(Date.now()); add(`Rescuers swapped. Round ${round + 1}.`) }}>Next 2 minutes</button></>}
        {cpr && <button className="btn ghost small" onClick={() => setSound(!sound)}>{sound ? <Volume2 /> : <VolumeX />} Beat sound {sound ? 'on' : 'off'}</button>}
      </div>
      {cpr && <small className="muted">Push on every pulse: 110 per minute. Rescuers swap every 2 minutes.</small>}
    </div>
  )
}

function MeasureHR({ add }: { add: (t: string) => void }) {
  const [camera, setCamera] = useState(false)
  const [typed, setTyped] = useState('')
  const [result, setResult] = useState<string | null>(null)
  if (camera) return (
    <div className="sos-scan">
      <FaceScan defaultSeconds={30} onSkip={() => setCamera(false)} onDone={(r) => {
        const txt = r.hr.ok && r.hr.value != null ? `Heart rate ${r.hr.value} bpm (camera estimate)` : `Heart rate: No data (${r.hr.note})`
        setResult(txt); add(txt); setCamera(false)
      }} />
    </div>
  )
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row">
        <button className="btn primary" onClick={() => setCamera(true)}><HeartPulse /> Measure with the camera (30 s)</button>
        <label className="row" style={{ gap: 6 }}>or type <input type="number" inputMode="numeric" value={typed} onChange={(e) => setTyped(e.target.value)} style={{ width: 80 }} aria-label="Heart rate in bpm" /> bpm</label>
        <button className="btn small" disabled={!(+typed > 20 && +typed < 250)} onClick={() => { const t = `Heart rate ${+typed} bpm (measured by hand)`; setResult(t); add(t); setTyped('') }}>Save</button>
      </div>
      {result && <div className="notice ok">{result}</div>}
    </div>
  )
}
