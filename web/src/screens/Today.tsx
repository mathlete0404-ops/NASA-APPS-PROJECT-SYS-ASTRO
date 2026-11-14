import { activeProfile, crewStatus, history, microgravityDays, missionDay, useStore } from '../data/store'
import { recommendations } from '../engine/plan'
import { LEVEL_RANK, METRICS, worst, type Level } from '../engine/status'
import { PHASES, RADIATION_CONTEXT } from '../content/mission'
import { boneLossEstimate } from '../engine/triage'
import { PATTERN_LABEL } from '../engine/triage'
import { REGION_LABEL } from '../content/cards'
import { EvidenceChips, fmtNum, Spark, StatusChip } from '../components/ui'
import { SpaceWeatherCard } from '../components/SpaceWeatherCard'

const GROUPS: { id: string; label: string }[] = [
  { id: 'face', label: 'Face scan' },
  { id: 'checkin', label: 'Mood & sleep' },
  { id: 'balance', label: 'Balance' },
  { id: 'body', label: 'Body' },
]

export function Today({ go }: { go: (tab: string) => void }) {
  const s = useStore()
  const p = activeProfile(s)
  if (!p) return null
  const st = crewStatus(s, p.id)
  const recs = recommendations(s, p)
  const day = missionDay(p)
  const mg = microgravityDays(p)
  const phase = PHASES[p.phase]
  const alerts = Object.entries(st).filter(([, r]) => r.level === 'act' || r.level === 'watch' || r.level === 'nodata')
    .sort((a, b) => LEVEL_RANK[b[1].level] - LEVEL_RANK[a[1].level])
  const lastSymptom = s.symptoms.filter((x) => x.crewId === p.id).sort((a, b) => b.ts.localeCompare(a.ts))[0]
  const overall: Level = Object.keys(st).length ? worst(Object.values(st).map((r) => r.level)) : 'nodata'
  const todayDone = s.sessions.some((x) => x.crewId === p.id && x.kind === 'daily' && x.ts.slice(0, 10) === new Date().toISOString().slice(0, 10))
  const doseRate = p.phase === 'transit' ? 1.84 : p.phase === 'surface' ? 0.64 : null

  return (
    <div className="stack">
      <div className="grid g2">
        <div className="card">
          <div className="row between">
            <div>
              <small>Mission day</small>
              <div className="kpi">{day >= 0 ? day : `L${day}`}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="pill">{phase.label} · {phase.gravity}</span>
              <p><small>{mg} days in microgravity</small></p>
            </div>
          </div>
          <p className="muted">{phase.body}</p>
          <p><b>Today’s focus:</b> {phase.focus}</p>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn primary" onClick={() => go('check')}>{todayDone ? 'Repeat daily check' : 'Start daily check'} →</button>
            <button className="btn" onClick={() => go('report')}>Report pain or symptom</button>
            {!phase.microgravity && <button className="btn" onClick={() => go('balance')}>Balance test</button>}
            <button className="btn" onClick={() => go('coach')}>Exercise coach</button>
          </div>
        </div>
        <div className={`banner ${overall}`}>
          <div className="row between">
            <h2>{p.id} · {p.role}</h2>
            <StatusChip level={overall} />
          </div>
          {alerts.length === 0 ? (
            <p>{Object.keys(st).length === 0 ? 'No measurements yet — run the daily check to start your baseline.' : overall === 'baseline' ? 'Building your personal baseline — keep doing the daily check.' : 'All tracked measures are within your own usual range.'}</p>
          ) : (
            <ul className="reasons">
              {alerts.map(([id, r]) => (
                <li key={id}>
                  <StatusChip level={r.level} /> <b>{METRICS[id].label}</b>{r.level !== 'nodata' && <>: {fmtNum(r.value)} {METRICS[id].unit} vs your usual {fmtNum(r.median)}</>}
                  <br /><small>{r.reasons.join(' ')}</small>
                </li>
              ))}
            </ul>
          )}
          {alerts.some(([, r]) => r.level === 'act') && (
            <p style={{ marginTop: 8 }}><b>Next step:</b> tell the crew medical officer today and repeat the check tomorrow morning.</p>
          )}
          {lastSymptom && (
            <p style={{ marginTop: 8 }}>
              <small>Last symptom report: {REGION_LABEL[lastSymptom.region]} · {PATTERN_LABEL[lastSymptom.result.pattern]} · {new Date(lastSymptom.ts).toLocaleDateString()}</small>
            </p>
          )}
        </div>
      </div>

      {GROUPS.map((g) => {
        const ids = Object.keys(METRICS).filter((id) => METRICS[id].group === g.id)
        return (
          <div key={g.id}>
            <h3 style={{ marginTop: 8 }}>{g.label}</h3>
            <div className="grid g4">
              {ids.map((id) => {
                const r = st[id]
                const h = history(s.sessions, p.id, id).slice(-21)
                const latest = h[h.length - 1]
                return (
                  <div className="card tight tile" key={id} title={r?.reasons.join('\n')}>
                    <div className="row between"><small>{METRICS[id].label}</small>{r ? <StatusChip level={r.level} n={r.n} /> : <StatusChip level="nodata" />}</div>
                    <div className="val">
                      {latest?.ok ? fmtNum(latest.value) : '—'} <small>{METRICS[id].unit}</small>
                    </div>
                    <Spark values={h.map((x) => (x.ok ? x.value : null))} median={r?.median} scale={r?.scale} />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <SpaceWeatherCard phase={p.phase} />

      <div className="grid g2">
        <div className="card">
          <h3>Bone & radiation context</h3>
          <p>Estimated weight-bearing bone change: <b>−{boneLossEstimate(mg)}%</b> <small>(educational: ~1%/month in microgravity; less with full exercise + nutrition)</small></p>
          {doseRate && <p>Estimated cumulative dose: <b>{Math.round(mg * doseRate)} mSv</b> <small>({doseRate} mSv/day published average; use vehicle dosimetry)</small></p>}
          <table>
            <thead><tr><th>Where</th><th className="num">mSv/day</th><th>Source</th></tr></thead>
            <tbody>
              {RADIATION_CONTEXT.map((r) => (
                <tr key={r.place}><td>{r.place}</td><td className="num">{r.mSvDay}</td><td><small>{r.source}</small></td></tr>
              ))}
            </tbody>
          </table>
          <EvidenceChips ids={['radlab', 'nutrition', 'nlsp']} />
        </div>
        <div className="card">
          <p className="kicker">Today’s plan</p>
          {recs.slice(0, 4).map((r) => (
            <div key={r.id} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
              <b style={{ fontSize: '.93rem' }}>{r.title}</b><br /><small>Because: {r.because[0]}</small>
            </div>
          ))}
          {recs.length === 0 && <p className="muted">Nothing extra today — follow your exercise and food plan.</p>}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn violet small" onClick={() => go('plan')}>Full plan: exercise & food</button>
            <button className="btn small" onClick={() => go('body')}>3D body</button>
          </div>
          {s.sessions.some((x) => x.crewId === p.id && x.synthetic) && <p style={{ marginTop: 8 }}><span className="pill">Synthetic demo history</span></p>}
        </div>
      </div>
    </div>
  )
}
