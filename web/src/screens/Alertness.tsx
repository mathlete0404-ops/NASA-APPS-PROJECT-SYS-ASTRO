// Alertness test (PVT-B style reaction test), ported from the team's first prototype.
// No camera needed, so it works anywhere, floating or not. Scoring lives in engine/pvt.ts.
import { useEffect, useRef, useState } from 'react'
import { Timer } from 'lucide-react'
import { activeProfile, addSession, crewStatus, history, missionDay, uid, useStore } from '../data/store'
import { DURATIONS, FALSE_START_MS, LAPSE_MS, nextWaitMs, summarize, TIMEOUT_MS, type PvtResult, type PvtTrials } from '../engine/pvt'
import { METRICS } from '../engine/status'
import { EvidenceChips, fmtNum, StatusChip } from '../components/ui'

type Phase = 'ready' | 'running' | 'done'
type Mode = 'wait' | 'stim' | 'good' | 'slow' | 'bad'

export function Alertness() {
  const p = activeProfile(useStore())
  if (!p) return null
  return <AlertnessFor key={p.id} />
}

function AlertnessFor() {
  const s = useStore()
  const p = activeProfile(s)!
  const st = crewStatus(s, p.id)
  const [seconds, setSeconds] = useState(60)
  const [phase, setPhase] = useState<Phase>('ready')
  const [mode, setMode] = useState<Mode>('wait')
  const [text, setText] = useState('')
  const [left, setLeft] = useState(0)
  const [result, setResult] = useState<PvtResult | null>(null)

  // Everything that must not trigger a render per frame lives in one ref.
  const run = useRef<{ t0: number; seconds: number; trials: PvtTrials; stage: 'wait' | 'stim' | 'fb'; stimT: number; timer: number; raf: number; tick: number } | null>(null)
  const stop = () => {
    const r = run.current
    if (!r) return
    clearTimeout(r.timer); cancelAnimationFrame(r.raf); clearInterval(r.tick)
    run.current = null
  }
  useEffect(() => stop, [])

  const finish = () => {
    const r = run.current
    if (!r) return
    const res = summarize(r.trials)
    stop()
    setResult(res)
    setPhase('done')
    addSession({
      id: uid(), crewId: p.id, ts: new Date().toISOString(), missionDay: missionDay(p), kind: 'pvt',
      measurements: [
        { metric: 'pvt_rt', value: res.ok ? res.medianRT : null, ok: res.ok, quality: res.ok ? 1 : 0, unit: METRICS.pvt_rt.unit, source: METRICS.pvt_rt.source, note: res.note },
        { metric: 'pvt_lapses', value: res.ok ? res.lapsePct : null, ok: res.ok, quality: res.ok ? 1 : 0, unit: METRICS.pvt_lapses.unit, source: METRICS.pvt_lapses.source, note: res.note },
      ],
    })
  }

  const schedule = () => {
    const r = run.current
    if (!r) return
    if ((performance.now() - r.t0) / 1000 >= r.seconds) return finish()
    r.stage = 'wait'
    setMode('wait'); setText('')
    r.timer = window.setTimeout(stimulus, nextWaitMs(Math.random()))
  }
  const feedback = (msg: string, m: Mode) => {
    const r = run.current
    if (!r) return
    r.stage = 'fb'
    cancelAnimationFrame(r.raf)
    setMode(m); setText(msg)
    r.timer = window.setTimeout(schedule, 1000)
  }
  const stimulus = () => {
    const r = run.current
    if (!r) return
    r.stage = 'stim'
    r.stimT = performance.now()
    setMode('stim')
    const count = () => {
      const q = run.current
      if (!q || q.stage !== 'stim') return
      const ms = Math.round(performance.now() - q.stimT)
      setText(String(ms))
      if (ms >= TIMEOUT_MS) { q.trials.rts.push(TIMEOUT_MS); return feedback('No response', 'bad') }
      q.raf = requestAnimationFrame(count)
    }
    count()
  }
  const respond = () => {
    const r = run.current
    if (!r) return
    if (r.stage === 'wait') {
      clearTimeout(r.timer)
      r.trials.falseStarts++
      return feedback('Too early. Wait for the counter.', 'bad')
    }
    if (r.stage === 'stim') {
      const rt = Math.round(performance.now() - r.stimT)
      if (rt < FALSE_START_MS) { r.trials.falseStarts++; return feedback(`${rt} ms: too fast, that was a guess`, 'bad') }
      r.trials.rts.push(rt)
      feedback(`${rt} ms`, rt >= LAPSE_MS ? 'slow' : 'good')
    }
  }

  const start = () => {
    stop()
    setResult(null)
    setPhase('running')
    setMode('wait'); setText('')
    setLeft(seconds)
    run.current = { t0: performance.now(), seconds, trials: { rts: [], falseStarts: 0 }, stage: 'wait', stimT: 0, timer: 0, raf: 0, tick: 0 }
    run.current.tick = window.setInterval(() => { const r = run.current; if (r) setLeft(Math.max(0, Math.ceil(r.seconds - (performance.now() - r.t0) / 1000))) }, 250)
    schedule()
  }
  const cancel = () => { stop(); setPhase('ready'); setText('') }

  // Space or Enter responds while a test runs (and does not scroll the page).
  useEffect(() => {
    if (phase !== 'running') return
    const key = (e: KeyboardEvent) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); respond() } }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
    // respond reads only refs and stable setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const past = history(s.sessions, p.id, 'pvt_rt').filter((x) => x.ok).slice(-5).reverse()

  return (
    <div className="grid g2">
      <div className="card pvt-card">
        <div className="card-h"><span className="ic"><Timer /></span><h3>Alertness test</h3><span className="sub">reaction time</span></div>
        {phase === 'ready' && (
          <>
            <p className="muted">Watch the box. A counter starts at a random moment. Press (tap, or Space) the instant you see it. Tired or slow responses show up here before you feel it, and they are compared with <b>your own</b> usual, not an average person.</p>
            <div className="seg" role="group" aria-label="Test length">
              {DURATIONS.map((d) => <button key={d.seconds} className={seconds === d.seconds ? 'on' : ''} aria-pressed={seconds === d.seconds} onClick={() => setSeconds(d.seconds)}>{d.label}</button>)}
            </div>
            <p><small className="muted">{DURATIONS.find((d) => d.seconds === seconds)?.note} Sit comfortably, silence notifications, use the same hand each time.</small></p>
            <button className="btn primary" onClick={start}>Start the test</button>
          </>
        )}
        {phase === 'running' && (
          <>
            <button type="button" className={`pvt-box ${mode}`} onPointerDown={(e) => { e.preventDefault(); respond() }} onClick={(e) => e.preventDefault()}
              aria-label="Reaction box. Press as soon as the counter appears." aria-live="off">
              <span className="pvt-text">{mode === 'wait' ? 'Wait…' : text}</span>
            </button>
            <div className="row between"><small className="mono">{left}s left</small><button className="btn ghost small" onClick={cancel}>Cancel</button></div>
          </>
        )}
        {phase === 'done' && result && (
          <div className="stack">
            {result.ok ? (
              <>
                <div className="pvt-kpis">
                  <span><small className="muted">Median reaction</small><b className="mono">{result.medianRT} ms</b></span>
                  <span><small className="muted">Slow responses</small><b className="mono">{result.lapses} of {result.valid}</b></span>
                  <span><small className="muted">Too early</small><b className="mono">{result.falseStarts}</b></span>
                </div>
                <p className="muted">{result.note} Fastest tenth {result.fastest10} ms, slowest tenth {result.slowest10} ms. Saved to your record.</p>
              </>
            ) : (
              <p><span className="chip nodata">No data</span> {result.note}</p>
            )}
            <div className="row"><button className="btn primary" onClick={start}>Test again</button><button className="btn" onClick={() => setPhase('ready')}>Done</button></div>
          </div>
        )}
      </div>

      <div className="stack">
        <div className="card">
          <h3>Against your own usual</h3>
          <table>
            <thead><tr><th>Measure</th><th className="num">Latest</th><th>Status</th></tr></thead>
            <tbody>
              {(['pvt_rt', 'pvt_lapses'] as const).map((id) => (
                <tr key={id}><td>{METRICS[id].label}</td><td className="num">{st[id]?.value != null ? `${fmtNum(st[id].value)} ${METRICS[id].unit}` : '—'}</td><td>{st[id] ? <StatusChip level={st[id].level} n={st[id].n} /> : <StatusChip level="nodata" />}</td></tr>
              ))}
            </tbody>
          </table>
          {past.length > 0 && <p><small className="muted">Recent median reaction: {past.map((x) => `${fmtNum(x.value)} ms`).join(' · ')}</small></p>}
          <p><small className="muted">Your first 7 tests set your baseline. A result that fails the check (too few responses, or mostly early presses) is shown as No data, never as Fine.</small></p>
        </div>
        <div className="card">
          <h3>What this measures</h3>
          <p className="muted">A psychomotor vigilance test (PVT-B style): a response of {LAPSE_MS} ms or slower is a lapse, and a response under {FALSE_START_MS} ms is a guess. Lapses and slower median reaction are standard signs of sleep loss and fatigue. It is a pattern, not a diagnosis.</p>
          <EvidenceChips ids={['pvt']} />
        </div>
      </div>
    </div>
  )
}
