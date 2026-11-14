import { useEffect, useRef, useState } from 'react'
import { activeProfile, addSession, crewStatus, missionDay, uid, useStore } from '../data/store'
import { SitToStand, swayMetrics, type BalanceResult, type PoseSample, type WalkVerdict } from '../engine/balance'
import { METRICS, type StatusResult } from '../engine/status'
import { drawPose, VisionSession } from '../vision/camera'
import { EvidenceChips, StatusChip } from '../components/ui'
import { PHASES } from '../content/mission'

type TestId = 'sway_eo' | 'sway_ec' | 'sway_tandem' | 'sts_time'
const TESTS: { id: TestId; name: string; how: string; seconds: number }[] = [
  { id: 'sway_eo', name: 'Feet together, eyes open', how: 'Stand with feet together, arms crossed, look at the screen.', seconds: 30 },
  { id: 'sway_ec', name: 'Feet together, eyes closed', how: 'Same stance, close your eyes at the beep. A second beep means done. Have a handrail or spotter near.', seconds: 30 },
  { id: 'sway_tandem', name: 'Tandem stance', how: 'One foot directly in front of the other, heel to toe, arms crossed.', seconds: 30 },
  { id: 'sts_time', name: '5× sit-to-stand', how: 'Sit on a chair, arms crossed. At the beep stand up fully and sit down 5 times as fast as is safe. Whole body in view.', seconds: 45 },
]

function beep(freq = 880, ms = 200) {
  try {
    const ac = new AudioContext()
    const o = ac.createOscillator()
    o.frequency.value = freq
    o.connect(ac.destination)
    o.start()
    setTimeout(() => { o.stop(); void ac.close() }, ms)
  } catch { /* no audio */ }
}
const say = (t: string) => { try { speechSynthesis.speak(new SpeechSynthesisUtterance(t)) } catch { /* ignore */ } }

export function walkVerdict(st: Record<string, StatusResult>): WalkVerdict {
  const ec = st.sway_ec
  if (!ec) return { level: 'nodata', title: 'No balance data yet', detail: 'Record your pre-flight baseline (7 sessions), then test again after landing.' }
  if (ec.level === 'nodata') return { level: 'nodata', title: 'No data — repeat the test', detail: 'The last eyes-closed test failed the quality check.' }
  if (ec.level === 'baseline') return { level: 'baseline', title: 'Building your balance baseline', detail: `${ec.n}/7 sessions recorded.` }
  const tandem = st.sway_tandem?.level
  if (ec.level === 'act' || tandem === 'act')
    return { level: 'stop', title: 'Not yet safe to walk unaided or start an EVA', detail: 'Sway is far above your pre-flight baseline. Hold handrails, sit down to move tools, retest in 2 hours, and tell the crew medical officer.' }
  if (ec.level === 'watch' || tandem === 'watch')
    return { level: 'spotter', title: 'Walk with a spotter or handrail', detail: 'Sway is above your usual. Avoid ladders, quick head turns and EVA prep until it is back in range.' }
  return { level: 'go', title: 'Balance at your baseline', detail: 'Eyes-closed sway is within your own pre-flight range.' }
}

export function Balance() {
  const s = useStore()
  const p = activeProfile(s)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [test, setTest] = useState<TestId>('sway_eo')
  const [phase, setPhase] = useState<'idle' | 'loading' | 'get-ready' | 'running' | 'done' | 'error'>('idle')
  const [left, setLeft] = useState(0)
  const [err, setErr] = useState('')
  const [count, setCount] = useState(0)
  const [result, setResult] = useState<BalanceResult | null>(null)
  const vs = useRef<VisionSession | null>(null)
  useEffect(() => () => vs.current?.stop(), [])
  if (!p) return null
  const st = crewStatus(s, p.id)
  const verdict = walkVerdict(st)
  const def = TESTS.find((t) => t.id === test)!
  const floating = PHASES[p.phase].microgravity

  const run = async () => {
    setPhase('loading'); setResult(null); setCount(0)
    const v = new VisionSession('pose')
    vs.current = v
    const samples: PoseSample[] = []
    const sts = new SitToStand()
    let t0 = 0
    let lastPose = 0
    const finish = (r: BalanceResult) => {
      v.stop(); vs.current = null
      beep(440, 350)
      say('Done')
      setResult(r)
      setPhase('done')
      addSession({ id: uid(), crewId: p.id, ts: new Date().toISOString(), missionDay: missionDay(p), kind: 'balance',
        measurements: [{ metric: test, value: r.value, ok: r.ok, quality: r.quality, unit: METRICS[test].unit, source: 'Balance · pose', note: r.note }] })
    }
    v.onResult = (r) => {
      if (canvas.current) drawPose(canvas.current, r.pose ?? null)
      if (r.pose) lastPose = r.ts
      if (!t0) return
      const el = (r.ts - t0) / 1000
      if (test === 'sts_time') {
        const n = sts.update(r.ts, r.pose ?? null)
        setCount(n)
        if (sts.done != null) return finish({ value: Math.round(sts.done * 10) / 10, ok: true, quality: 1, note: '5 full stands counted from hip height.' })
        if (el >= def.seconds) return finish({ value: null, ok: false, quality: 0, note: `Only ${n}/5 stands detected — keep hips and knees in view.` })
      } else {
        samples.push({ t: r.ts, p: r.pose ?? null })
        if (el >= def.seconds) return finish(swayMetrics(samples, def.seconds))
      }
      setLeft(Math.max(0, Math.ceil(def.seconds - el)))
    }
    try {
      await v.start()
      setPhase('get-ready')
      say(def.how)
      // 5 s to get into position, then the beep starts the test
      for (let i = 5; i > 0; i--) { setLeft(i); await new Promise((r) => setTimeout(r, 1000)) }
      if (!vs.current) return
      beep(); if (test === 'sway_ec') say('Close your eyes')
      t0 = performance.now()
      if (performance.now() - lastPose > 2000) say('I cannot see you. Step back.')
      setPhase('running')
    } catch (e) {
      v.stop()
      setErr(String((e as Error).message ?? e)); setPhase('error')
    }
  }

  return (
    <div className="stack">
      {floating && (
        <div className="banner nodata">
          <h2>Balance tests need gravity</h2>
          <p>You are floating ({PHASES[p.phase].label}). Standing balance and sit-to-stand have no meaning without an “up” and “down”, so they are switched off. NASA tests balance <b>before flight</b> (your baseline) and <b>right after landing</b> — Crew Mirror does the same and will ask for it when the phase changes to Landing, Surface or Return.</p>
          <p style={{ fontSize: '.9rem' }}>In flight, keep up resistive and treadmill sessions (see Plan) — they protect the leg strength that balance relies on after landing.</p>
        </div>
      )}
      <div className={`banner ${verdict.level}`}>
        <div className="row between"><h2>{floating ? 'Last balance result' : 'Safe to walk / EVA?'} — {verdict.title}</h2>{st.sway_ec && <StatusChip level={st.sway_ec.level} n={st.sway_ec.n} />}</div>
        <p>{verdict.detail}</p>
        <small>Compared with your pre-flight baseline (first 7 balance sessions). Rule: eyes-closed or tandem sway |z| &gt; 3 → stop; &gt; 2 → spotter.</small>
      </div>
      <div className="grid g2">
        <div className="stack">
          <div className="stage">
            <canvas ref={canvas} width={640} height={480} />
            {(phase === 'running' || phase === 'get-ready') && <div className="count">{phase === 'get-ready' ? `Ready ${left}` : test === 'sts_time' ? `${count}/5` : `${left}s`}</div>}
            <div className="overlay">
              {phase === 'idle' && 'Stand 2–3 m from the camera so shoulders and hips (or whole body) are visible.'}
              {phase === 'loading' && 'Loading on-device pose model…'}
              {phase === 'get-ready' && def.how}
              {phase === 'running' && (test === 'sway_ec' ? 'Eyes closed. Stay still.' : 'Hold still.')}
              {phase === 'error' && `Camera or model failed: ${err}`}
              {phase === 'done' && 'Test finished.'}
            </div>
          </div>
          <p className="privacy">🔒 Video stays in this browser. Only the skeleton is drawn and only numbers are saved.</p>
        </div>
        <div className="card stack">
          <h2>Balance test</h2>
          <div className="row">
            {TESTS.map((t) => (
              <button key={t.id} className={`btn small${test === t.id ? ' sel' : ''}`} disabled={phase === 'running' || phase === 'loading' || phase === 'get-ready'} onClick={() => { setTest(t.id); setPhase('idle'); setResult(null) }}>{t.name}</button>
            ))}
          </div>
          <p>{def.how}</p>
          <button className="btn primary" onClick={run} disabled={floating || phase === 'running' || phase === 'loading' || phase === 'get-ready'}>{floating ? 'Available after landing' : `Start ${def.name.toLowerCase()}`}</button>
          {result && (
            <div className="card tight">
              <div className="row between">
                <b>{METRICS[test].label}</b>
                {result.ok ? <StatusChip level={st[test]?.level ?? 'baseline'} n={st[test]?.n} /> : <StatusChip level="nodata" />}
              </div>
              <div className="tile"><div className="val">{result.ok ? result.value : '—'} <small>{METRICS[test].unit}</small></div></div>
              <small>{result.note} {st[test]?.reasons.join(' ')}</small>
            </div>
          )}
          <table>
            <thead><tr><th>Test</th><th className="num">Last</th><th>Status</th></tr></thead>
            <tbody>
              {TESTS.map((t) => (
                <tr key={t.id}><td>{t.name}</td><td className="num">{st[t.id]?.value != null ? `${st[t.id].value} ${METRICS[t.id].unit}` : '—'}</td><td>{st[t.id] ? <StatusChip level={st[t.id].level} n={st[t.id].n} /> : <StatusChip level="nodata" />}</td></tr>
              ))}
            </tbody>
          </table>
          <small className="muted">% SW = hip-midpoint sway as a percentage of shoulder width, so camera distance does not matter.</small>
          <EvidenceChips ids={['walkline', 'fieldtest']} />
        </div>
      </div>
    </div>
  )
}
