// Camera exercise coach (MediaPipe Pose, 3D world landmarks): rep count, live joint
// angle, form cues, pain before/after, and an export of the tracked 3D coordinates.
import { useEffect, useRef, useState } from 'react'
import { Download, Play, Square } from 'lucide-react'
import { activeProfile, addWorkout, uid, useStore } from '../data/store'
import { COACH, faultText, formScore, initCoach, joints, stepCoach, type CoachExercise, type CoachState } from '../engine/coach'
import { drawPose, VisionSession, type PoseFrame } from '../vision/camera'
import { PHASES } from '../content/mission'
import { StatusChip, cameraHelp } from '../components/ui'

const LANDMARK_NAMES = ['nose', 'l_eye_in', 'l_eye', 'l_eye_out', 'r_eye_in', 'r_eye', 'r_eye_out', 'l_ear', 'r_ear', 'mouth_l', 'mouth_r', 'l_shoulder', 'r_shoulder', 'l_elbow', 'r_elbow', 'l_wrist', 'r_wrist', 'l_pinky', 'r_pinky', 'l_index', 'r_index', 'l_thumb', 'r_thumb', 'l_hip', 'r_hip', 'l_knee', 'r_knee', 'l_ankle', 'r_ankle', 'l_heel', 'r_heel', 'l_foot', 'r_foot']
const HL: Record<CoachExercise, number[]> = { squat: [25, 26], lunge: [25, 26], arm_raise: [11, 12], calf_raise: [27, 28], sit_to_stand: [23, 24, 25, 26] }

function beep(f = 880) {
  try { const ac = new AudioContext(); const o = ac.createOscillator(); o.frequency.value = f; o.connect(ac.destination); o.start(); setTimeout(() => { o.stop(); void ac.close() }, 120) } catch { /* no audio */ }
}

function download(name: string, text: string, type: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

export function Coach({ go }: { go: (t: string) => void }) {
  const s = useStore()
  const p = activeProfile(s)
  const canvas = useRef<HTMLCanvasElement>(null)
  const vs = useRef<VisionSession | null>(null)
  const frames = useRef<{ t: number; w: Float32Array }[]>([])
  const [ex, setEx] = useState<CoachExercise>('squat')
  const [phase, setPhase] = useState<'idle' | 'loading' | 'live' | 'done' | 'error'>('idle')
  const [err, setErr] = useState('')
  const [st, setSt] = useState<CoachState>(initCoach())
  const [painBefore, setPainBefore] = useState(0)
  const [painAfter, setPainAfter] = useState(0)
  const [hurtAt, setHurtAt] = useState<number | null>(null)
  const [saved, setSaved] = useState(false)
  useEffect(() => () => vs.current?.stop(), [])
  if (!p) return null
  const def = COACH[ex]
  const floating = PHASES[p.phase].microgravity
  const blocked = floating && def.needsGravity
  const history = s.workouts.filter((w) => w.crewId === p.id && !w.exercise.startsWith('plan:')).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 6)

  const start = async () => {
    setPhase('loading'); setSt(initCoach()); setSaved(false); setHurtAt(null); frames.current = []
    const v = new VisionSession('pose')
    vs.current = v
    let state = initCoach()
    let lastReps = 0
    v.onResult = (r) => {
      const pose = r.pose as PoseFrame | null
      if (canvas.current) drawPose(canvas.current, pose ?? null, state.faultsNow.length ? HL[ex] : undefined)
      if (!pose) return
      if (pose.world && frames.current.length < 9000) frames.current.push({ t: r.ts, w: pose.world })
      state = stepCoach(ex, state, joints(pose), r.ts)
      if (state.reps.length > lastReps) { lastReps = state.reps.length; beep(state.reps[lastReps - 1].faults.length ? 440 : 880) }
      setSt(state)
    }
    try { await v.start(); setPhase('live') } catch (e) { v.stop(); setErr(String((e as Error).message ?? e)); setPhase('error') }
  }
  const stop = () => { vs.current?.stop(); vs.current = null; setPhase('done') }

  const save = () => {
    const faults: Record<string, number> = {}
    st.reps.forEach((r) => r.faults.forEach((f) => { faults[f] = (faults[f] ?? 0) + 1 }))
    const best = ex === 'arm_raise' ? Math.round(Math.max(st.romMaxL, st.romMaxR)) : st.reps.length ? Math.round(Math.min(...st.reps.map((r) => r.min))) : undefined
    addWorkout({
      id: uid(), crewId: p.id, ts: new Date().toISOString(), exercise: ex, reps: st.reps.length, formScore: formScore(st.reps), faults,
      bestAngle: best, romL: ex === 'arm_raise' ? Math.round(st.romMaxL) : undefined, romR: ex === 'arm_raise' ? Math.round(st.romMaxR) : undefined,
      painBefore, painAfter, source: 'coach',
    })
    setSaved(true)
  }

  const exportJSON = () => download(`crew-mirror-${ex}-landmarks.json`, JSON.stringify({
    exercise: ex, units: 'metres, hip-centred (MediaPipe pose world landmarks)', landmarks: LANDMARK_NAMES,
    frames: frames.current.map((f) => ({ t_ms: Math.round(f.t), xyz: Array.from(f.w, (v) => Math.round(v * 1e4) / 1e4) })),
  }), 'application/json')
  const exportCSV = () => {
    const head = ['t_ms', ...LANDMARK_NAMES.flatMap((n) => [`${n}_x`, `${n}_y`, `${n}_z`])].join(',')
    const rows = frames.current.map((f) => [Math.round(f.t), ...Array.from(f.w, (v) => v.toFixed(4))].join(','))
    download(`crew-mirror-${ex}-landmarks.csv`, [head, ...rows].join('\n'), 'text/csv')
  }

  const score = formScore(st.reps)
  return (
    <div className="stack">
      <div className="row">
        {(Object.keys(COACH) as CoachExercise[]).map((id) => (
          <button key={id} className={`btn small${ex === id ? ' sel' : ''}`} disabled={phase === 'live' || phase === 'loading'} onClick={() => { setEx(id); setPhase('idle'); setSt(initCoach()) }}>{COACH[id].name}</button>
        ))}
      </div>
      {blocked && (
        <div className="banner nodata">
          <h2>{def.name} needs gravity</h2>
          <p>You are in the <b>{PHASES[p.phase].label}</b> phase. {def.inFlight} The coach is still available so you can rehearse form, but reps will not count toward your plan.</p>
        </div>
      )}
      <div className="split-3d">
        <div className="stack">
          <div className="stage" style={{ maxWidth: '100%' }}>
            <canvas ref={canvas} width={640} height={480} />
            {phase === 'live' && <div className="count">{st.reps.length}<small style={{ fontSize: '1rem' }}>/{def.target}</small></div>}
            <div className="overlay">
              {phase === 'idle' && `${def.how} (${def.view === 'side' ? 'side' : 'front'} view, whole body in frame)`}
              {phase === 'loading' && 'Loading on-device pose model…'}
              {phase === 'live' && <><b>{def.angleLabel}: {st.live}{ex === 'calf_raise' ? ' cm' : '°'}</b> — {st.cue}</>}
              {phase === 'done' && `Done: ${st.reps.length} reps, form ${score}%.`}
              {phase === 'error' && cameraHelp(err)}
            </div>
          </div>
          <div className="row">
            {phase !== 'live' ? <button className="btn primary" onClick={start} disabled={phase === 'loading'}><Play /> Start {def.name.toLowerCase()}</button>
              : <button className="btn" onClick={stop}><Square /> Finish set</button>}
            {ex === 'arm_raise' && phase === 'live' && <button className="btn danger" onClick={() => setHurtAt(st.live)}>It hurts here ({st.live}°)</button>}
            <small className="privacy">🔒 On-device. Joint angles use 3D world landmarks, so camera distance does not matter.</small>
          </div>
        </div>
        <div className="stack">
          <div className="card">
            <p className="kicker">This set</p>
            <div className="grid g3">
              <div><div className="kpi">{st.reps.length}</div><small>reps (goal {def.target})</small></div>
              <div><div className="kpi" style={{ color: score >= 80 ? 'var(--usual)' : score >= 50 ? 'var(--watch)' : 'var(--act)' }}>{st.reps.length ? `${score}%` : '—'}</div><small>clean reps</small></div>
              <div><div className="kpi">{ex === 'arm_raise' ? `${Math.round(Math.max(st.romMaxL, st.romMaxR))}°` : st.reps.length ? `${Math.round(Math.min(...st.reps.map((r) => r.min)))}°` : '—'}</div><small>{ex === 'arm_raise' ? 'best shoulder range' : 'deepest angle'}</small></div>
            </div>
            {ex === 'arm_raise' && (st.romMaxL > 0) && <p><small>Left {Math.round(st.romMaxL)}° · Right {Math.round(st.romMaxR)}°{hurtAt != null ? ` · pain starts at ${hurtAt}°` : ''}</small></p>}
            <div className="stack" style={{ marginTop: 10 }}>
              {st.reps.slice(-6).reverse().map((r) => (
                <div key={r.n} className="row between" style={{ fontSize: '.88rem' }}>
                  <span className="mono">rep {r.n} · {Math.round(ex === 'arm_raise' || ex === 'calf_raise' ? r.max : r.min)}{ex === 'calf_raise' ? ' cm' : '°'} · {((r.t1 - r.t0) / 1000).toFixed(1)} s</span>
                  {r.faults.length ? <span className="chip watch" title={r.faults.map(faultText).join('\n')}>{r.faults.length} cue{r.faults.length > 1 ? 's' : ''}</span> : <span className="chip usual">clean</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="card stack">
            <div className="slider"><label htmlFor="pb">Pain before</label><input id="pb" type="range" min={0} max={10} value={painBefore} onChange={(e) => setPainBefore(+e.target.value)} /><output>{painBefore}/10</output></div>
            <div className="slider"><label htmlFor="pa">Pain after</label><input id="pa" type="range" min={0} max={10} value={painAfter} onChange={(e) => setPainAfter(+e.target.value)} /><output>{painAfter}/10</output></div>
            {painAfter - painBefore >= 2 && <div className="notice err">Pain rose by {painAfter - painBefore} points. Stop this exercise and report the pain.</div>}
            <div className="row">
              <button className="btn primary" disabled={phase !== 'done' || !st.reps.length || saved} onClick={save}>{saved ? 'Saved ✓' : 'Save set'}</button>
              {painAfter - painBefore >= 2 && <button className="btn danger" onClick={() => go('report')}>Report pain</button>}
              <button className="btn small" disabled={!frames.current.length || phase === 'live'} onClick={exportJSON}><Download /> 3D JSON</button>
              <button className="btn small" disabled={!frames.current.length || phase === 'live'} onClick={exportCSV}><Download /> CSV</button>
            </div>
            <small className="muted">Exports contain only 3D joint coordinates (no video). Open them in Blender or a spreadsheet.</small>
          </div>
          <div className="card">
            <p className="kicker">Recent sets</p>
            {history.length === 0 ? <p className="muted">No sets yet.</p> : (
              <table>
                <thead><tr><th>Date</th><th>Exercise</th><th className="num">Reps</th><th>Form</th></tr></thead>
                <tbody>{history.map((w) => (
                  <tr key={w.id}><td>{new Date(w.ts).toLocaleDateString()}</td><td>{COACH[w.exercise as CoachExercise]?.name ?? w.exercise}</td><td className="num">{w.reps}</td>
                    <td><StatusChip level={w.formScore >= 80 ? 'usual' : w.formScore >= 50 ? 'watch' : 'act'} /> <small>{w.formScore}%</small></td></tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
