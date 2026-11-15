// "Body": the 3D anatomy with the crew member's current problems lit up. Tap anything to
// learn what it is, see its history, or report pain right there.
import { lazy, Suspense, useMemo, useState } from 'react'
import { HeartPulse, Info, Layers, MapPin, ScanFace, Search } from 'lucide-react'
import manifest from '../generated/anatomy_manifest.json'
import { activeProfile, setReportDraft, useStore } from '../data/store'
import { problemsFor, type Problem } from '../body3d/problems'
import type { Highlight, Picked } from '../body3d/BodyViewer'
import { CARDS, REGION_LABEL } from '../content/cards'
import { SOURCES, KIND_LABEL } from '../content/sources'
import { PATTERN_LABEL } from '../engine/triage'
import { EvidenceChips } from '../components/ui'

const BodyViewer = lazy(() => import('../body3d/BodyViewer'))
// On a phone the 3D view must leave room to scroll: dragging on it turns the body, not the page.
const BODY_H = typeof window !== 'undefined' && window.innerWidth < 900 ? 'min(620px, 58svh)' : 'min(620px, calc(100svh - 160px))'
const LAYER_NAME: Record<string, string> = { skin: 'Skin region', muscles: 'Muscle', skeleton: 'Bone', nerves: 'Nerve', joints: 'Disc / ligament' }

export function Body({ go }: { go: (t: string) => void }) {
  const s = useStore()
  const p = activeProfile(s)
  const [picked, setPicked] = useState<Picked | null>(null)
  const [stack, setStack] = useState<Picked[]>([])
  const [q, setQ] = useState('')
  const all = useMemo(() => Object.entries(manifest.structures as Record<string, { label: string; side: string; layer: string; region: string }>)
    .map(([zname, v]) => ({ zname, ...v })), [])
  const results = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (t.length < 2) return []
    return all.filter((x) => x.label.toLowerCase().includes(t)).slice(0, 12)
  }, [q, all])
  const [active, setActive] = useState<Problem | null>(null)
  const problems = useMemo(() => (p ? problemsFor(s, p.id) : []), [s, p])
  if (!p) return null
  const hasData = s.sessions.some((x) => x.crewId === p.id) || s.symptoms.some((x) => x.crewId === p.id)

  const highlights: Highlight[] = active ? active.highlight : problems.flatMap((x) => x.highlight)
  const focus = active ? { region: active.region, side: active.side } : null
  const history = picked ? s.symptoms.filter((x) => x.crewId === p.id && x.region === picked.region).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 4) : []
  const card = picked ? CARDS[picked.region] : undefined
  const referred = picked ? Object.entries(SOURCES).flatMap(([reg, list]) => (list ?? []).filter((src) => src.match.test(picked.label)).map((src) => ({ reg, src }))) : []

  const report = () => {
    if (!picked) return
    setReportDraft({ region: picked.region, side: picked.side, structure: picked.label })
    go('report')
  }

  return (
    <div className="split-3d">
      <div className="stack">
        <Suspense fallback={<div className="body3d" style={{ height: BODY_H, display: 'grid', placeItems: 'center', color: '#94a3b8' }}>Loading 3D anatomy…</div>}>
          <BodyViewer height={BODY_H} highlights={highlights} selected={picked?.zname} selectedLayer={picked?.layer} onPick={(pk, st) => { setPicked(pk); setStack(st) }} focus={focus} />
        </Suspense>
        <div className="legend">
          <span><i className="legend-dot" style={{ background: '#ef4444' }} />Act / see medical officer</span>
          <span><i className="legend-dot" style={{ background: '#f59e0b' }} />Watch / self-care</span>
          <span><i className="legend-dot" style={{ background: '#2dd4bf' }} />Selected</span>
          <span><i className="legend-dot" style={{ background: '#f2c94c' }} />Nerves</span>
          <small>Drag to rotate · scroll/pinch to zoom · tap to select</small>
        </div>
      </div>

      <div className="stack">
        <div className="card">
          <div className="card-h"><span className="ic"><Search /></span><h3>Find a structure</h3></div>
          <input type="search" aria-label="Search the 3D body" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${all.length.toLocaleString()} bones, muscles, nerves… e.g. “soleus”, “scaphoid”`} style={{ width: '100%' }} />
          {results.length > 0 && (
            <div className="stack" style={{ marginTop: 8, maxHeight: 240, overflowY: 'auto' }}>
              {results.map((r) => (
                <button key={r.zname} className="problem" style={{ padding: 7 }} onClick={() => { setPicked({ zname: r.zname, label: r.label, region: r.region as Picked['region'], side: r.side as Picked['side'], layer: r.layer as Picked['layer'] }); setStack([]); setQ('') }}>
                  <span style={{ flex: 1 }}><b>{r.label}</b>{r.side !== 'middle' ? ` · ${r.side}` : ''}<br /><small>{LAYER_NAME[r.layer]} · {REGION_LABEL[r.region as keyof typeof REGION_LABEL]}</small></span>
                </button>
              ))}
            </div>
          )}
          <small className="muted">The view switches to show what you pick.</small>
        </div>

        <div className="card">
          <div className="card-h"><span className="ic"><HeartPulse /></span><h3>Needs attention</h3><span className="sub">last 14 days</span></div>
          {problems.length === 0 && (hasData
            ? <p className="muted">Nothing flagged right now: no measurement outside your normal and no recent pain reports.</p>
            : <>
              <p className="muted" style={{ marginTop: 0 }}>No checks or pain reports yet. After your daily checks, anything outside your normal, and any pain you report, lights up on the body here.</p>
              <button className="btn primary small" onClick={() => go('check')}><ScanFace /> Start today’s check</button>
            </>)}
          <div className="stack" style={{ marginTop: 6 }}>
            {Object.entries(problems.reduce<Record<string, Problem[]>>((acc, x) => { const k = `${x.region}|${x.side ?? ''}`; (acc[k] ??= []).push(x); return acc }, {})).map(([k, list]) => {
              const x = list[0]
              const on = active && list.some((y) => y.id === active.id)
              const worstTone = list.some((y) => y.tone === 'act') ? 'act' : 'watch'
              return (
                <button key={k} className={`problem${on ? ' on' : ''}`} onClick={() => setActive(on ? null : { ...x, tone: worstTone, highlight: list.flatMap((y) => y.highlight) })}>
                  <span className="legend-dot" style={{ background: worstTone === 'act' ? '#ef4444' : '#f59e0b', marginTop: 5 }} />
                  <span style={{ flex: 1 }}>
                    <b>{REGION_LABEL[x.region]}{x.side && x.side !== 'middle' && x.side !== 'both' ? ` · ${x.side}` : ''}</b>
                    {list.map((y) => <small key={y.id} style={{ display: 'block', marginTop: 3 }}>{y.detail}</small>)}
                  </span>
                </button>
              )
            })}
          </div>
          {active && <button className="btn small ghost" style={{ marginTop: 8 }} onClick={() => setActive(null)}>Show all problems</button>}
        </div>

        {picked ? (
          <div className="card">
            <div className="strip"><span>{LAYER_NAME[picked.layer]} · {REGION_LABEL[picked.region]}</span><span>{picked.side}</span></div>
            <h2 style={{ marginBottom: 2 }}>{picked.label}</h2>
            <p className="muted" style={{ fontSize: '.9rem' }}>{picked.side !== 'middle' ? `${picked.side[0].toUpperCase()}${picked.side.slice(1)} side · ` : ''}{REGION_LABEL[picked.region]}</p>
            {stack.length > 1 && (
              <div style={{ margin: '6px 0' }}>
                <small className="kicker"><Layers size={12} style={{ verticalAlign: -2 }} /> Under your finger, front to back</small>
                <div className="row" style={{ gap: 6, marginTop: 4 }}>
                  {stack.slice(0, 6).map((x) => (
                    <button key={x.zname} className={`btn small${x.zname === picked.zname ? ' sel' : ''}`} onClick={() => setPicked(x)}>{x.label}</button>
                  ))}
                </div>
              </div>
            )}
            {card && <p style={{ fontSize: '.92rem' }}><Info size={14} style={{ verticalAlign: -2 }} /> {card.space[0]}</p>}
            {referred.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <small className="kicker">Can cause pain in</small>
                <ul className="reasons" style={{ fontSize: '.88rem' }}>
                  {referred.slice(0, 4).map(({ reg, src }) => <li key={src.id + reg}><b>{REGION_LABEL[reg as keyof typeof REGION_LABEL]}</b> — {KIND_LABEL[src.kind]}: {src.why}</li>)}
                </ul>
              </div>
            )}
            {history.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <small className="kicker">Your reports here</small>
                <ul className="reasons" style={{ fontSize: '.88rem' }}>
                  {history.map((h) => <li key={h.id}>{new Date(h.ts).toLocaleDateString()} · {h.kind} {h.intensity}/10 · {PATTERN_LABEL[h.result.pattern]}</li>)}
                </ul>
              </div>
            )}
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={report}><MapPin /> It hurts here</button>
              <button className="btn" onClick={() => { setPicked(null); setStack([]) }}>Clear</button>
            </div>
            {card && <EvidenceChips ids={card.evidence} />}
          </div>
        ) : (
          <div className="card">
            <div className="card-h"><span className="ic"><MapPin /></span><h3>Tap anywhere on the body</h3></div>
            <p className="muted" style={{ fontSize: '.92rem', marginTop: 0 }}>Switch between <b>Body</b>, <b>Muscles</b>, <b>Bones</b> and <b>Nerves</b> at the top. Drag to turn, scroll to zoom. Tap a spot and choose <b>It hurts here</b> to report pain from exactly there.</p>
            <small>Anatomy: Z-Anatomy (CC BY-SA 4.0), from BodyParts3D (CC BY-SA 2.1 JP). {all.length.toLocaleString()} structures; sex-specific anatomy is not included.</small>
          </div>
        )}
      </div>
    </div>
  )
}
