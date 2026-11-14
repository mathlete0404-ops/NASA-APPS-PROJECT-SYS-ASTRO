import { useEffect, useRef, useState } from 'react'
import { activeProfile, addSession, crewStatus, missionDay, uid, useStore } from '../data/store'
import type { Measurement } from '../data/types'
import { analyseFaceScan, type FaceScanResult, type FaceSample } from '../engine/face'
import { METRICS } from '../engine/status'
import { drawFace, VisionSession } from '../vision/camera'
import { EvidenceChips, fmtNum, StatusChip } from '../components/ui'

type Step = 'scan' | 'mood' | 'done'

export function DailyCheck({ go }: { go: (t: string) => void }) {
  const s = useStore()
  const p = activeProfile(s)
  const [step, setStep] = useState<Step>('scan')
  const [scan, setScan] = useState<FaceScanResult | null>(null)
  const [skipped, setSkipped] = useState(false)
  const [mood, setMood] = useState({ mood: 7, energy: 7, sleep_hours: 7, sleep_quality: 7 })
  const [mass, setMass] = useState('')
  const [savedId, setSavedId] = useState<string | null>(null)
  if (!p) return null

  const save = () => {
    const meas: Measurement[] = []
    const add = (metric: string, value: number | null, ok: boolean, quality: number, note?: string) =>
      meas.push({ metric, value, ok, quality, unit: METRICS[metric].unit, source: METRICS[metric].source, note })
    if (scan) {
      add('hr_rest', scan.hr.value, scan.hr.ok, scan.hr.quality, scan.hr.note)
      add('resp_rate', scan.resp.value, scan.resp.ok, scan.resp.quality, scan.resp.note)
      add('blink_rate', scan.blinkRate.value, scan.blinkRate.ok, scan.blinkRate.quality, scan.blinkRate.note)
      add('perclos', scan.perclos.value, scan.perclos.ok, scan.perclos.quality, scan.perclos.note)
      add('face_width', scan.faceWidth.value, scan.faceWidth.ok, scan.faceWidth.quality, scan.faceWidth.note)
    }
    for (const [k, v] of Object.entries(mood)) add(k, v, true, 1)
    const id = uid()
    addSession({ id, crewId: p.id, ts: new Date().toISOString(), missionDay: missionDay(p), kind: 'daily', measurements: meas })
    if (mass && +mass > 20 && +mass < 250)
      addSession({ id: uid(), crewId: p.id, ts: new Date().toISOString(), missionDay: missionDay(p), kind: 'mass',
        measurements: [{ metric: 'body_mass', value: +mass, ok: true, quality: 1, unit: 'kg', source: 'Scale / SLAMMD' }] })
    setSavedId(id)
    setStep('done')
  }

  return (
    <div className="stack">
      <div className="steps">
        <span className={step === 'scan' ? 'on' : 'done'}>1 · Face scan</span>
        <span className={step === 'mood' ? 'on' : step === 'done' ? 'done' : ''}>2 · Mood & sleep</span>
        <span className={step === 'done' ? 'on' : ''}>3 · Result</span>
      </div>
      {step === 'scan' && (
        <FaceScan
          defaultSeconds={p.scanSeconds ?? 30}
          onDone={(r) => { setScan(r); setStep('mood') }}
          onSkip={() => { setSkipped(true); setStep('mood') }}
        />
      )}
      {step === 'mood' && (
        <div className="grid g2">
          <div className="card stack">
            <h2>How are you today?</h2>
            {([
              ['mood', 'Mood', 0, 10, 1],
              ['energy', 'Energy', 0, 10, 1],
              ['sleep_hours', 'Sleep (hours)', 0, 12, 0.25],
              ['sleep_quality', 'Sleep quality', 0, 10, 1],
            ] as const).map(([k, label, min, max, stepv]) => (
              <div className="slider" key={k}>
                <label htmlFor={k}>{label}</label>
                <input id={k} type="range" min={min} max={max} step={stepv} value={mood[k]} onChange={(e) => setMood({ ...mood, [k]: +e.target.value })} />
                <output>{mood[k]}</output>
              </div>
            ))}
            <label className="row">Body mass today (optional, kg) <input type="number" step="0.1" value={mass} onChange={(e) => setMass(e.target.value)} style={{ width: 100 }} /></label>
            <div className="row"><button className="btn primary" onClick={save}>Save check</button></div>
          </div>
          <div className="card">
            <h3>Face scan</h3>
            {skipped || !scan ? <p className="muted">Skipped — face measures will show “No data” today.</p> : <ScanSummary r={scan} />}
          </div>
        </div>
      )}
      {step === 'done' && savedId && <Result crewId={p.id} go={go} scan={scan} />}
    </div>
  )
}

function ScanSummary({ r }: { r: FaceScanResult }) {
  const rows: [string, string, typeof r.hr][] = [
    ['hr_rest', 'Heart rate (estimate)', r.hr],
    ['resp_rate', 'Breathing rate (estimate)', r.resp],
    ['blink_rate', 'Blink rate', r.blinkRate],
    ['perclos', 'Eye closure', r.perclos],
    ['face_width', 'Face-width ratio', r.faceWidth],
  ]
  return (
    <table>
      <tbody>
        {rows.map(([id, label, m]) => (
          <tr key={id}>
            <td>{label}</td>
            <td className="num">{m.ok && m.value != null ? `${m.value} ${METRICS[id].unit}` : <span className="chip nodata">No data</span>}</td>
            <td><small>{m.note}</small></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Result({ crewId, go, scan }: { crewId: string; go: (t: string) => void; scan: FaceScanResult | null }) {
  const s = useStore()
  const st = crewStatus(s, crewId)
  const ids = ['hr_rest', 'resp_rate', 'blink_rate', 'perclos', 'face_width', 'mood', 'energy', 'sleep_hours', 'sleep_quality']
  const act = ids.some((id) => st[id]?.level === 'act')
  return (
    <div className="stack">
      <div className={`banner ${act ? 'act' : ids.some((id) => st[id]?.level === 'watch') ? 'watch' : 'usual'}`}>
        <h2>Check saved</h2>
        <p>{act ? 'Something is well outside your usual: tell the crew medical officer today.' : 'Compared with your own baseline — not with population averages.'}</p>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Measure</th><th className="num">Today</th><th>Status</th><th>Why</th></tr></thead>
          <tbody>
            {ids.map((id) => st[id] && (
              <tr key={id}>
                <td>{METRICS[id].label}</td>
                <td className="num">{st[id].value != null ? `${fmtNum(st[id].value)} ${METRICS[id].unit}` : '—'}</td>
                <td><StatusChip level={st[id].level} n={st[id].n} /></td>
                <td><small>{st[id].reasons.join(' ')}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
        {scan && <EvidenceChips ids={['pos']} />}
      </div>
      <div className="row">
        <button className="btn primary" onClick={() => go('today')}>Back to today</button>
        <button className="btn" onClick={() => go('trends')}>See trends</button>
      </div>
    </div>
  )
}

export function FaceScan({ onDone, onSkip, defaultSeconds = 30 }: { onDone: (r: FaceScanResult) => void; onSkip: () => void; defaultSeconds?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<'idle' | 'loading' | 'scanning' | 'error'>('idle')
  const [err, setErr] = useState('')
  const [left, setLeft] = useState(0)
  const [dur, setDur] = useState(defaultSeconds)
  const [info, setInfo] = useState('')
  const [live, setLive] = useState({ face: false, blink: 0 })
  const session = useRef<VisionSession | null>(null)

  useEffect(() => () => session.current?.stop(), [])

  const start = async () => {
    setPhase('loading')
    const samples: FaceSample[] = []
    const vs = new VisionSession('face')
    session.current = vs
    let t0 = 0
    vs.onResult = (r) => {
      if (canvas.current) drawFace(canvas.current, r.face ?? null)
      if (!t0) return
      samples.push({ t: r.ts, f: r.face ?? null })
      setLive({ face: !!r.face, blink: r.face?.blink ?? 0 })
      const el = (r.ts - t0) / 1000
      setLeft(Math.max(0, Math.ceil(dur - el)))
      if (el >= dur) {
        vs.stop()
        session.current = null
        onDone(analyseFaceScan(samples))
      }
    }
    try {
      const i = await vs.start()
      setInfo(`MediaPipe Face Landmarker · ${i.delegate} · model ${i.model}`)
      t0 = performance.now()
      setLeft(dur)
      setPhase('scanning')
    } catch (e) {
      vs.stop()
      setErr(String((e as Error).message ?? e))
      setPhase('error')
    }
  }

  return (
    <div className="grid g2">
      <div className="stack">
        <div className="stage">
          <canvas ref={canvas} width={640} height={480} />
          {phase === 'scanning' && <div className="count">{left}s</div>}
          <div className="overlay">
            {phase === 'idle' && 'Sit still, face the screen, even light on your face.'}
            {phase === 'loading' && 'Loading on-device model…'}
            {phase === 'scanning' && (live.face ? 'Hold still and breathe normally.' : 'Face not found — look at the screen.')}
            {phase === 'error' && `Camera or model failed: ${err}`}
          </div>
        </div>
        <p className="privacy">🔒 Video stays in this browser. Only landmark points are drawn, and only numbers are saved. {info}</p>
      </div>
      <div className="card stack">
        <h2>Daily face scan</h2>
        <p>Measures, against <b>your own</b> baseline:</p>
        <ul className="reasons">
          <li><b>Heart rate estimate</b> from tiny skin-colour changes (rPPG, POS method).</li>
          <li><b>Breathing rate estimate</b> from the slow rise and fall of your head and skin tone (60 s scan).</li>
          <li><b>Blink rate & eye closure</b> (fatigue) from eye blendshapes.</li>
          <li><b>Face-width ratio</b> (cheek width ÷ pupil distance) for headward fluid shift.</li>
        </ul>
        <p className="muted">Bad light, movement or a hidden face → “No data”, never “Fine”.</p>
        <div className="row">
          <label>Length <select value={dur} onChange={(e) => setDur(+e.target.value)} disabled={phase !== 'idle'}>
            <option value={30}>30 s (quick)</option><option value={60}>60 s (best)</option>
          </select></label>
        </div>
        <div className="row">
          <button className="btn primary" onClick={start} disabled={phase === 'loading' || phase === 'scanning'}>
            {phase === 'loading' ? 'Starting…' : 'Start scan'}
          </button>
          <button className="btn ghost" onClick={() => { session.current?.stop(); onSkip() }}>Skip today</button>
        </div>
        {phase === 'scanning' && <div className="row"><small>Eye closure now: {(live.blink * 100).toFixed(0)}%</small></div>}
      </div>
    </div>
  )
}
