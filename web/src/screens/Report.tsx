import { lazy, Suspense, useMemo, useState } from 'react'
import { Box, Camera, Map as MapIcon } from 'lucide-react'
import { activeProfile, addSymptom, microgravityDays, takeReportDraft, uid, useStore } from '../data/store'
import {
  DANGER_LABELS, PATTERN_LABEL, referIntensity, triage, WEIGHT_BEARING,
  type DangerAnswers, type Kind, type Region, type TestAnswers, type TriageResult,
} from '../engine/triage'
import { CARDS, REGION_LABEL, REGION_TESTS } from '../content/cards'
import { EXERCISES } from '../content/exercises'
import { KIND_LABEL, redFlagsFrom, scoreSources, SOURCES, type SourceScore } from '../content/sources'
import { PHASES } from '../content/mission'
import { BodyMap } from '../components/BodyMap'
import { PointToPain } from '../components/PointToPain'
import { EvidenceChips } from '../components/ui'
import type { BodyViewerProps, Highlight, Picked } from '../body3d/BodyViewer'

const BodyViewer = lazy(() => import('../body3d/BodyViewer'))

type Step = 'danger' | 'where' | 'tests' | 'source' | 'result'
type YN = boolean | undefined
type Side = 'left' | 'right' | 'middle' | 'both'

function YesNo({ value, onChange }: { value: YN; onChange: (v: boolean) => void }) {
  return (
    <div className="yn">
      <button className={`btn small yes${value === true ? ' sel' : ''}`} onClick={() => onChange(true)}>Yes</button>
      <button className={`btn small no${value === false ? ' sel' : ''}`} onClick={() => onChange(false)}>No</button>
    </div>
  )
}

const CONTEXT = ['sleep', 'exercise', 'after EVA', 'after landing', 'workstation', 'handrail translation']
const LEVEL_TITLE: Record<TriageResult['level'], string> = {
  act_now: 'Act now: contact the crew medical officer',
  cmo: 'Contact the crew medical officer — no exercises for now',
  self_care: 'Self-care is reasonable — follow the plan below',
}
const STEP_LABEL: Record<Step, string> = { danger: 'Danger signs', where: 'Where & what', tests: 'Press & move', source: 'Find the source', result: 'Result' }

export function Viewer3D(props: BodyViewerProps) {
  return (
    <Suspense fallback={<div className="body3d" style={{ height: props.height ?? 520, display: 'grid', placeItems: 'center', color: '#94a3b8' }}>Loading 3D anatomy…</div>}>
      <BodyViewer {...props} />
    </Suspense>
  )
}

export function Report({ go }: { go: (t: string) => void }) {
  const s = useStore()
  const p = activeProfile(s)
  const draft = useMemo(() => takeReportDraft(), [])
  const [step, setStep] = useState<Step>('danger')
  const [danger, setDanger] = useState<Partial<Record<keyof DangerAnswers, boolean>>>({})
  const [region, setRegion] = useState<Region | undefined>(draft?.region)
  const [side, setSide] = useState<Side>(draft?.side ?? 'middle')
  const [structure, setStructure] = useState<string | undefined>(draft?.structure)
  const [pickedZ, setPickedZ] = useState<string | undefined>()
  const [mode, setMode] = useState<'3d' | 'camera' | 'map'>('3d')
  const [kind, setKind] = useState<Kind>('pain')
  const [intensity, setIntensity] = useState(3)
  const [onset, setOnset] = useState<'sudden' | 'gradual'>('gradual')
  const [context, setContext] = useState<string[]>([])
  const [tests, setTests] = useState<TestAnswers>({})
  const [romOn, setRomOn] = useState(false)
  const [rom, setRom] = useState(90)
  const [answers, setAnswers] = useState<Record<string, boolean | undefined>>({})
  const [result, setResult] = useState<TriageResult | null>(null)
  const [top, setTop] = useState<SourceScore | null>(null)
  if (!p) return null
  const mg = microgravityDays(p)
  const floating = PHASES[p.phase].microgravity

  const dangerKeys = Object.keys(DANGER_LABELS) as (keyof DangerAnswers)[]
  const allAnswered = dangerKeys.every((k) => danger[k] !== undefined)
  const anyDanger = dangerKeys.some((k) => danger[k])
  const tt = region ? REGION_TESTS[region] : null
  const sources = region ? SOURCES[region] ?? [] : []
  const ranked = region ? scoreSources(region, answers) : []
  const limit = region ? referIntensity(region, mg) : 8
  const sideForEngine: 'left' | 'right' | 'middle' = side === 'both' ? 'middle' : side

  const finish = (dangerOnly = false) => {
    const t: TestAnswers = Object.fromEntries(Object.entries(tests).filter(([, v]) => v !== undefined)) as TestAnswers
    if (romOn) t.rom_pain_angle = rom
    if (region && !dangerOnly) Object.assign(t, redFlagsFrom(region, answers))
    const reg = region ?? 'other'
    const input = { danger: danger as DangerAnswers, region: reg, kind, intensity, onset, tests: dangerOnly ? {} : t, microgravity_days: mg }
    const r = triage(input)
    const best = region && !dangerOnly ? scoreSources(region, answers)[0] : undefined
    const src = best && best.score > 0 ? best : null
    setResult(r); setTop(src)
    addSymptom({
      id: uid(), crewId: p.id, ts: new Date().toISOString(), region: reg, side: sideForEngine,
      kind, intensity, onset, context, danger: input.danger, tests: input.tests, microgravityDays: mg, result: r,
      structure, structureMatch: structure, pointedBy: mode,
      source: src ? { id: src.source.id, label: src.source.label, kind: src.source.kind, score: src.score, reasons: src.reasons } : undefined,
    })
    setStep('result')
  }

  const afterWhere = () => {
    if (!region) return
    if (region === 'trunk_front') return finish()
    if (!tt) return sources.length ? setStep('source') : finish()
    setStep('tests')
  }
  const restart = () => {
    setStep('danger'); setDanger({}); setRegion(undefined); setStructure(undefined); setPickedZ(undefined)
    setTests({}); setAnswers({}); setResult(null); setTop(null); setRomOn(false); setContext([])
  }
  const onPick = (pk: Picked, _stack?: Picked[]) => { setRegion(pk.region); setSide(pk.side); setStructure(pk.label); setPickedZ(pk.zname) }

  const siteHighlights: Highlight[] = region ? [{ tone: 'pain', region, side, layers: ['skin', 'muscles'] }] : []
  const sourceHighlights: Highlight[] = ranked.map((r, i) => ({
    tone: i === 0 && r.score > 0 ? 'source-top' : r.source.kind === 'nerve' ? 'nerve' : 'source',
    match: r.source.match, side: r.source.kind === 'disc' || r.source.from ? 'both' : side,
  }))

  return (
    <div className="stack">
      <div className="steps">
        {(['danger', 'where', 'tests', 'source', 'result'] as Step[]).map((x, i) => <span key={x} className={step === x ? 'on' : ''}>{i + 1} · {STEP_LABEL[x]}</span>)}
      </div>

      {step === 'danger' && (
        <div className="grid g2">
          <div className="card">
            <h2>First: any danger signs right now?</h2>
            <p className="muted">Always asked first. Any “yes” goes straight to the crew medical officer — no exercises.</p>
            {draft && <p className="notice" style={{ marginTop: 8 }}>Reporting from the 3D body: <b>{draft.structure ?? REGION_LABEL[draft.region]}</b>{draft.side !== 'middle' ? ` (${draft.side})` : ''}</p>}
            {dangerKeys.map((k) => (
              <div className="q" key={k}><span>{DANGER_LABELS[k]}</span><YesNo value={danger[k]} onChange={(v) => setDanger((d) => ({ ...d, [k]: v }))} /></div>
            ))}
            <div className="row" style={{ marginTop: 12 }}>
              {anyDanger ? <button className="btn danger" onClick={() => finish(true)}>Continue → Act now</button>
                : <button className="btn primary" disabled={!allAnswered} onClick={() => setStep('where')}>All “no” — continue</button>}
            </div>
          </div>
          <div className="card">
            <h3>Why these five?</h3>
            <p className="muted">They can signal a heart problem, stroke, bleeding in the head, spinal cord or nerve-root compression, or a fracture. None can be safely handled by an app, so fixed rules — not AI — send them to the crew medical officer and the reason is always shown.</p>
          </div>
        </div>
      )}

      {step === 'where' && (
        <div className="split-3d">
          <div className="stack">
            <div className="seg">
              <button className={mode === '3d' ? 'on' : ''} onClick={() => setMode('3d')}><Box /> Tap 3D body</button>
              <button className={mode === 'camera' ? 'on' : ''} onClick={() => setMode('camera')}><Camera /> Point on camera</button>
              <button className={mode === 'map' ? 'on' : ''} onClick={() => setMode('map')}><MapIcon /> Simple map</button>
            </div>
            {mode === '3d' && <Viewer3D height={540} onPick={onPick} selected={pickedZ} highlights={siteHighlights} pickLayers={['skin', 'muscles', 'skeleton', 'joints']} />}
            {mode === 'camera' && <PointToPain onConfirm={(r, sd) => { setRegion(r); setSide(sd); setStructure(undefined) }} />}
            {mode === 'map' && <div className="card"><BodyMap region={region} side={side} onPick={(r, sd) => { setRegion(r); setSide(sd); setStructure(undefined) }} /></div>}
          </div>
          <div className="card stack">
            <div>
              <p className="kicker">Location</p>
              <h2 style={{ margin: 0 }}>{region ? (structure ?? REGION_LABEL[region]) : 'Tap or point where it hurts'}</h2>
              {region && <small>{REGION_LABEL[region]}{side !== 'middle' ? ` · ${side}` : ''}</small>}
            </div>
            <div className="row">{(['pain', 'stiffness', 'weakness', 'numbness'] as Kind[]).map((k) => <button key={k} className={`btn small${kind === k ? ' sel' : ''}`} onClick={() => setKind(k)}>{k}</button>)}</div>
            <div className="slider">
              <label htmlFor="int">Intensity</label>
              <input id="int" type="range" min={0} max={10} value={intensity} onChange={(e) => setIntensity(+e.target.value)} />
              <output>{intensity}/10</output>
            </div>
            {region && WEIGHT_BEARING.has(region) && limit < 8 && <small className="muted">Day {mg} in microgravity: pain ≥ {limit}/10 here goes to the crew medical officer (bone-loss weighting).</small>}
            <div className="row">Onset {(['gradual', 'sudden'] as const).map((o) => <button key={o} className={`btn small${onset === o ? ' sel' : ''}`} onClick={() => setOnset(o)}>{o}</button>)}</div>
            <div className="row">Side {(['left', 'right', 'both', 'middle'] as const).map((o) => <button key={o} className={`btn small${side === o ? ' sel' : ''}`} onClick={() => setSide(o)}>{o}</button>)}</div>
            <div>
              <small>Started during / after:</small>
              <div className="row" style={{ marginTop: 4 }}>
                {CONTEXT.map((c) => <button key={c} className={`btn small${context.includes(c) ? ' sel' : ''}`} onClick={() => setContext((cx) => (cx.includes(c) ? cx.filter((x) => x !== c) : [...cx, c]))}>{c}</button>)}
              </div>
            </div>
            <div className="row">
              <button className="btn ghost" onClick={() => setStep('danger')}>← Back</button>
              <button className="btn primary" disabled={!region} onClick={afterWhere}>Continue</button>
            </div>
          </div>
        </div>
      )}

      {step === 'tests' && tt && region && (
        <div className="split-3d">
          <div className="card">
            <h2>Press & move test · {REGION_LABEL[region]}</h2>
            <p className="muted">Do each gently. The answers give a <b>pattern</b>, not a diagnosis.</p>
            {([
              ['bony_tender', `${tt.bone} — sharp pain on one bony spot?`],
              ['muscle_tender', `${tt.muscle} — does it hurt?`],
              ['resisted_pain', `${tt.resisted} — does it hurt?`],
              ['stretch_pain', `${tt.stretch} — does it hurt?`],
              ...(WEIGHT_BEARING.has(region) && !floating ? [['cannot_bear_weight', 'Can you NOT put weight on it?'] as [keyof TestAnswers, string]] : []),
              ['swelling', 'Is there visible swelling?'],
              ['spreading_tingling', 'Tingling or numbness spreading down an arm or leg?'],
            ] as [keyof TestAnswers, string][]).map(([k, label]) => (
              <div className="q" key={k}><span>{label}</span><YesNo value={tests[k] as YN} onChange={(v) => setTests((t) => ({ ...t, [k]: v }))} /></div>
            ))}
            <div className="q">
              <span>{tt.rom} — does it start to hurt at some angle?</span>
              <YesNo value={romOn ? true : tests.rom_pain_angle === null ? false : undefined} onChange={(v) => { setRomOn(v); setTests((t) => ({ ...t, rom_pain_angle: v ? undefined : null })) }} />
            </div>
            {romOn && <div className="slider"><label htmlFor="rom">Painful angle</label><input id="rom" type="range" min={0} max={180} step={5} value={rom} onChange={(e) => setRom(+e.target.value)} /><output>{rom}°</output></div>}
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn ghost" onClick={() => setStep('where')}>← Back</button>
              <button className="btn primary" onClick={() => (sources.length ? setStep('source') : finish())}>{sources.length ? 'Next: find the source' : 'See result'}</button>
            </div>
          </div>
          <Viewer3D height={520} highlights={siteHighlights} focus={{ region, side }} selected={pickedZ} />
        </div>
      )}

      {step === 'source' && region && (
        <div className="split-3d">
          <div className="stack">
            <Viewer3D height={560} highlights={[...sourceHighlights, ...siteHighlights]} initialLayers={['muscles', 'skeleton', 'nerves', 'joints']} initialXray={0.7} focus={{ region, side }} />
            <div className="legend">
              <span><i className="legend-dot" style={{ background: '#ef4444' }} />Where it hurts</span>
              <span><i className="legend-dot" style={{ background: '#8b5cf6' }} />Most likely source</span>
              <span><i className="legend-dot" style={{ background: '#a78bfa' }} />Other candidates</span>
              <span><i className="legend-dot" style={{ background: '#fde047' }} />Nerve path</span>
            </div>
          </div>
          <div className="card stack">
            <div>
              <p className="kicker">Where does it come from?</p>
              <p className="muted" style={{ fontSize: '.92rem' }}>Pain is often felt away from its source — a nerve root in the back can hurt in the leg, the neck in the shoulder, the hip in the knee. Answer a few questions; the candidates light up on the body.</p>
            </div>
            {ranked.map((r, i) => (
              <div key={r.source.id} className={`src${i === 0 && r.score > 0 ? ' top' : ''}`}>
                <div className="row between">
                  <b>{r.source.label}</b>
                  <span className="chip baseline">{KIND_LABEL[r.source.kind]}{r.source.from ? ` · from ${REGION_LABEL[r.source.from]}` : ''}</span>
                </div>
                <small>{r.source.why}{r.source.space ? ` ${r.source.space}` : ''}</small>
                {r.source.questions.map((q) => (
                  <div className="q" key={q.id}>
                    <span style={{ fontSize: '.9rem' }}>{q.q}{q.redFlag && <small style={{ color: 'var(--act)' }}> · safety question</small>}</span>
                    <YesNo value={answers[`${r.source.id}:${q.id}`]} onChange={(v) => setAnswers((a) => ({ ...a, [`${r.source.id}:${q.id}`]: v }))} />
                  </div>
                ))}
                <div className="bar"><span style={{ width: `${(r.score / Math.max(1, r.max)) * 100}%` }} /></div>
              </div>
            ))}
            <div className="row">
              <button className="btn ghost" onClick={() => setStep(tt ? 'tests' : 'where')}>← Back</button>
              <button className="btn primary" onClick={() => finish()}>See result</button>
            </div>
          </div>
        </div>
      )}

      {step === 'result' && result && <ResultView r={result} region={region} side={side} top={top} floating={floating} go={go} restart={restart} structure={structure} />}
    </div>
  )
}

function ResultView({ r, region, side, top, floating, go, restart, structure }: {
  r: TriageResult; region?: Region; side: Side; top: SourceScore | null; floating: boolean; go: (t: string) => void; restart: () => void; structure?: string
}) {
  const card = region ? CARDS[region] : undefined
  const hl: Highlight[] = region ? [
    { tone: 'pain', region, side, layers: ['skin', 'muscles'] },
    ...(top ? [{ tone: (top.source.kind === 'nerve' ? 'nerve' : 'source-top') as Highlight['tone'], match: top.source.match, side: (top.source.kind === 'disc' || top.source.from ? 'both' : side) as Side }] : []),
  ] : []
  return (
    <div className="stack">
      <div className={`banner ${r.level}`}>
        <h2>{LEVEL_TITLE[r.level]}</h2>
        <p><b>{PATTERN_LABEL[r.pattern]}</b> — a pattern, not a diagnosis.{structure ? ` Location: ${structure}${side !== 'middle' ? ` (${side})` : ''}.` : ''}</p>
        <ul className="reasons">{r.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
        {r.level !== 'self_care' && (
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn danger" onClick={() => go('medical')}>Open crew medical officer view</button>
            <small>Stay where you are; do not exercise the area.</small>
          </div>
        )}
      </div>

      {region && region !== 'other' && r.pattern !== 'danger_sign' && (
        <div className="split-3d">
          <Viewer3D height={460} highlights={hl} focus={{ region, side }} initialLayers={['muscles', 'skeleton', 'nerves', 'joints']} initialXray={top && (top.source.kind === 'nerve' || top.source.kind === 'disc' || top.source.kind === 'bone') ? 0.7 : 0} showControls={false} />
          <div className="card stack">
            <p className="kicker">Most likely source</p>
            {top ? (
              <>
                <h2 style={{ margin: 0 }}>{top.source.label}</h2>
                <span className="chip baseline">{KIND_LABEL[top.source.kind]}{top.source.from ? ` · referred from ${REGION_LABEL[top.source.from]}` : ''}</span>
                <p style={{ fontSize: '.92rem' }}>{top.source.why}</p>
                <ul className="reasons" style={{ fontSize: '.88rem' }}>{top.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
              </>
            ) : <p className="muted">No source question was answered “yes”, so the location itself is the best guide.</p>}
          </div>
        </div>
      )}

      {card && r.pattern !== 'danger_sign' && (
        <div className="card">
          <h2>Why does it hurt? · {card.title}</h2>
          <div className="why">
            <div className="part"><h3>1 · What space is doing</h3><ul>{card.space.map((x) => <li key={x}>{x}</li>)}</ul></div>
            <div className="part"><h3>2 · What your test showed</h3><ul>{r.reasons.map((x) => <li key={x}>{x}</li>)}{top && <li>Likely source: {top.source.label}.</li>}</ul></div>
            <div className="part"><h3>3 · What helps</h3>
              {r.level === 'self_care' ? <ul>{card.helps.map((x) => <li key={x}>{x}</li>)}</ul> : <p>Wait for the crew medical officer. Rest the area; no exercises until cleared.</p>}
            </div>
          </div>
          <EvidenceChips ids={card.evidence} />
        </div>
      )}

      {r.exercises_allowed && card && card.exercises.length > 0 && (
        <div className="card">
          <h2>Relief exercises</h2>
          <p className="muted">Rate pain before and after. Recheck in 48 h; if not better in 7 days, or worse, contact the crew medical officer.{floating ? ' You are floating — follow the “In flight” line for each.' : ''}</p>
          <div className="grid g3">
            {card.exercises.map((id) => EXERCISES[id]).filter((e) => e && !(floating && e.needsGravity)).map((e) => (
              <div className="ex" key={e.id}>
                <h3>{e.name}</h3>
                <small>{e.target} · {e.dose}</small>
                <ol>{e.steps.map((x) => <li key={x}>{x}</li>)}</ol>
                {floating && e.inFlight && <p style={{ fontSize: '.85rem' }}><b>In flight:</b> {e.inFlight}</p>}
                <small style={{ color: 'var(--watch)' }}>{e.stop}</small>
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 12 }}><button className="btn violet" onClick={() => go('coach')}>Do them with the camera coach</button></div>
        </div>
      )}
      <div className="row">
        <button className="btn" onClick={restart}>New report</button>
        <button className="btn" onClick={() => go('plan')}>See today’s plan</button>
        <button className="btn ghost" onClick={() => go('body')}>Open 3D body</button>
      </div>
    </div>
  )
}
