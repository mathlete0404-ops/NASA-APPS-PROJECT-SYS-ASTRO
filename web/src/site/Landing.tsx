import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight, Brain, CloudOff, EyeOff, HeartPulse, Radio, ScanFace, ShieldAlert, Stethoscope, Activity, ListChecks, Database,
} from 'lucide-react'
import { CountUp, Logo, StatusChip, ThemeToggle } from '../components/ui'
import { MirrorBuild } from './MirrorBuild'
import { Story, type Step } from './Story'
import { PHASES } from '../content/mission'
import { OSDR_EVIDENCE } from '../content/evidence'
import { AnalyteChart } from '../screens/Evidence'
import type { Level } from '../engine/status'

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

function useHeroProgress(ref: React.RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setProgress(1); return }
    const desktop = matchMedia('(min-width: 961px)')
    let target = 0, shown = 0, raf = 0, glide = 0, last = 0
    const step = (now: number) => {
      glide = 0
      const dt = last ? Math.min(4, (now - last) / 16.67) : 1
      last = now
      const diff = target - shown
      if (Math.abs(diff) < 0.001) { shown = target; last = 0 } else {
        const mv = Math.max(-0.007 * dt, Math.min(0.007 * dt, diff * (1 - Math.pow(0.92, dt))))
        shown += mv
        glide = requestAnimationFrame(step)
      }
      setProgress(Math.round(shown * 1000) / 1000)
    }
    const measure = () => {
      raf = 0
      const r = ref.current?.getBoundingClientRect()
      if (!r) return
      const vh = innerHeight
      const p = desktop.matches ? (64 - r.top) / Math.max(1, r.height - (vh - 64)) : (vh * 0.9 - r.top) / (vh * 0.9)
      target = Math.min(1, Math.max(0, desktop.matches ? p : 0.15 + p))
      if (!glide) glide = requestAnimationFrame(step)
    }
    const on = () => { if (!raf) raf = requestAnimationFrame(measure) }
    measure()
    addEventListener('scroll', on, { passive: true })
    addEventListener('resize', on)
    return () => { removeEventListener('scroll', on); removeEventListener('resize', on); cancelAnimationFrame(raf); cancelAnimationFrame(glide) }
  }, [ref])
  return progress
}

const L = (cls: string, t: string) => <span className={cls}>{t}</span>
const STEPS: Step[] = [
  {
    kicker: 'Scan', title: 'Sixty seconds. No Earth.', hsl: '168 76% 55%', label: 'face_scan.log',
    body: 'Sit in front of any laptop or tablet. On-device models read your face and posture; only numbers are kept. Bad light or movement gives “No data” — never a guess.',
    points: ['MediaPipe on-device', 'rPPG heart-rate estimate', 'Fatigue · fluid shift'],
    win: <>
      {[
        [L('tk-v', 'landmarks'), '  478 ', L('tk-f', '✓')],
        [L('tk-v', 'light'), '      128 ', L('tk-f', '✓'), '  motion 0.004 ', L('tk-f', '✓')],
        [L('tk-k', 'hr_rest'), '    63 bpm ', L('tk-p', '(estimate, q 0.52)')],
        [L('tk-k', 'blink'), '      16.2 /min'],
        [L('tk-k', 'perclos'), '    4.1 %'],
        [L('tk-k', 'face_width'), ' 2.31 ×IPD'],
        [L('tk-p', 'video uploaded: 0 bytes')],
      ].map((l, i) => <div key={i} className="term-line" data-in style={{ animationDelay: `${120 + i * 55}ms` }}><span className="ln">{i + 1}</span><span>{l.map((x, k) => <span key={k}>{x}</span>)}</span></div>)}
    </>,
  },
  {
    kicker: 'Compare', title: 'You vs. you.', hsl: '262 83% 72%', label: 'baseline.ts',
    body: 'Your first 7 sessions become your personal baseline. Every new value gets a robust z-score against it — not against a population average that hides real change.',
    points: ['Median / MAD', '|z| > 2 Watch', '|z| > 3 Act'],
    win: <>
      <div data-in className="term-line"><span className="ln">1</span><span>{L('tk-k', 'baseline')} = first 7 good sessions</span></div>
      <div data-in className="term-line"><span className="ln">2</span><span>{L('tk-k', 'z')} = (value − median) / (1.4826 × MAD)</span></div>
      <div data-in style={{ marginTop: 14, display: 'grid', gap: 8, fontFamily: 'var(--font-body)' }}>
        {([['Sleep', '4.5 h', 'z −5.0', 'act'], ['Heart rate', '63 bpm', 'z +0.4', 'usual'], ['Face width', '2.38', 'z +2.3', 'watch']] as const).map(([k, v, z, l]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#111a2e', borderRadius: 7, padding: '7px 10px' }}>
            <span style={{ width: 90 }}>{k}</span><b style={{ color: '#fff' }}>{v}</b>
            <span className="tk-p" style={{ fontFamily: 'var(--font-mono)', fontSize: '.78rem' }}>{z}</span>
            <span style={{ marginLeft: 'auto' }}><DarkChip level={l} /></span>
          </div>
        ))}
      </div>
    </>,
  },
  {
    kicker: 'Triage', title: 'Rules, not AI.', hsl: '43 96% 56%', label: 'triage.rules',
    body: 'Danger signs are always asked first. A press-and-move test gives a pattern — never a diagnosis — and every result shows the rule that produced it.',
    points: ['Danger signs first', 'Fracture & nerve → CMO', 'Bone-loss weighting'],
    win: <>
      {['Chest pain', 'One-sided weakness / slurred speech', 'Sudden severe headache', 'Back pain + leg numbness', 'Pain after fall / impact'].map((d, i) => (
        <div key={d} data-in className="term-line" style={{ animationDelay: `${100 + i * 50}ms` }}><span className="ln">{i + 1}</span><span>{L('tk-f', '✓ no ')} {d}</span></div>
      ))}
      <div data-in style={{ marginTop: 12, borderTop: '1px dashed #334155', paddingTop: 10 }}>
        <div>{L('tk-k', 'pattern')} = muscle strain / inflammation</div>
        <div>{L('tk-k', 'day 96')} → refer if pain ≥ {L('tk-s', '7/10')} {L('tk-p', '(was 8, bone −3.2%)')}</div>
      </div>
    </>,
  },
  {
    kicker: 'Act', title: 'Know what to do next.', hsl: '199 89% 60%', label: 'plan.today',
    body: 'Self-care with “why it hurts” cards and relief exercises, or a straight line to the crew medical officer. Messages to Earth queue with real light-time delay.',
    points: ['Why-it-hurts cards', 'Relief exercises', 'Delayed downlink'],
    win: <>
      <div data-in style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: '#fff', fontWeight: 700 }}>Knees-to-chest (fetal tuck)</div>
      <div data-in className="tk-p" style={{ fontSize: '.78rem' }}>Lower back · 3 × 30 s hold · stop if pain rises ≥ 2</div>
      <div data-in style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '2px solid hsl(199 89% 60% / .6)', background: 'hsl(199 89% 60% / .1)', borderRadius: 7, padding: '8px 12px' }}>
        <span>→ Earth flight surgeon</span><span className="tk-s">in transit · 11 min 42 s</span>
      </div>
    </>,
  },
]

function DarkChip({ level }: { level: Level }) {
  const c = { act: '#fca5a5', watch: '#fcd34d', usual: '#6ee7b7', nodata: '#cbd5e1', baseline: '#a5b4fc' }[level]
  return <span className="chip" style={{ color: c, background: 'transparent' }}>{{ act: 'Act', watch: 'Watch', usual: 'Usual', nodata: 'No data', baseline: 'Baseline' }[level]}</span>
}

export function Landing({ open }: { open: (tab?: string) => void }) {
  const hero = useRef<HTMLElement>(null)
  const progress = useHeroProgress(hero)
  const h = OSDR_EVIDENCE.headline
  const hgb = OSDR_EVIDENCE.analytes.find((a) => a.analyte === 'WHITE BLOOD CELL COUNT') ?? OSDR_EVIDENCE.analytes[0]
  const lines = ['Your body changes in space.', 'Your mirror notices first.']

  return (
    <div>
      <header className="site-header">
        <div className="wrap">
          <a className="brand" href="#/" onClick={(e) => { e.preventDefault(); scrollTo('top') }}><Logo /> Crew Mirror</a>
          <nav>
            <a className="link" href="#/" onClick={(e) => { e.preventDefault(); scrollTo('how') }}>How it works</a>
            <a className="link" href="#/" onClick={(e) => { e.preventDefault(); scrollTo('evidence') }}>NASA data</a>
            <a className="link" href="#/" onClick={(e) => { e.preventDefault(); scrollTo('safety') }}>Safety</a>
            <ThemeToggle />
            <button className="btn primary small" onClick={() => open()}>Open app <ArrowRight /></button>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section id="top" ref={hero} className="dark-sec hero">
        <div className="gridbg" />
        <div className="pin">
          <div>
            <div className="badge-line fade-in"><i />Offline · On-device · Personal baseline</div>
            <h1>
              {lines.map((line, li) => (
                <span key={li} className="line">
                  {line.split(' ').map((w, wi) => (
                    <span key={wi} className={`word${li === 1 ? ' accent' : ''}`} style={{ animationDelay: `${120 + (li * 5 + wi) * 55}ms` }}>{w}</span>
                  ))}
                </span>
              ))}
            </h1>
            <p className="lede fade-in" style={{ animationDelay: '.6s' }}>
              A few minutes a day in front of a laptop. Crew Mirror measures fatigue, balance, pain and recovery against each astronaut’s <b style={{ color: '#fff' }}>own</b> baseline, explains why the body is changing, and says what to do next — without waiting for Earth.
            </p>
            <div className="ctas fade-in" style={{ animationDelay: '.7s' }}>
              <button className="btn primary" onClick={() => open()}>Open the crew app <ArrowRight /></button>
              <button className="btn outline-dark" onClick={() => scrollTo('how')}>How it works ↓</button>
            </div>
            <dl className="fade-in" style={{ animationDelay: '.8s' }}>
              <div><dt>Inspiration4 pairs</dt><dd><CountUp to={h.pairs} /></dd></div>
              <div><dt>Hidden by “normal”</dt><dd><CountUp to={h.outside_personal_inside_population} /></dd></div>
              <div><dt>Video uploaded</dt><dd>0 B</dd></div>
            </dl>
            <div className="scroll-hint hide-sm" style={{ opacity: progress > 0.97 ? 0 : 1 }}>
              <span>Scroll to run a check</span><span className="bar"><b style={{ width: `${progress * 100}%` }} /></span>
            </div>
          </div>
          <MirrorBuild progress={progress} />
        </div>
      </section>

      {/* ── Mission phases shelf ── */}
      <section className="section">
        <div className="wrap">
          <p className="kicker">Mission-phase aware</p>
          <h2 className="big">One check, five phases of the body.</h2>
          <p className="sub">The phase decides which tests are offered, how cautiously bony pain is treated, and what every card says.</p>
        </div>
        <div className="wrap" style={{ marginTop: 26 }}>
          <div className="shelf">
            {Object.values(PHASES).map((ph, i) => (
              <button key={ph.id} className="lift phase-card" onClick={() => open('today')} style={{ textAlign: 'left', cursor: 'pointer', ['--layer' as string]: ['hsl(168 76% 55%)', 'hsl(262 83% 66%)', 'hsl(43 96% 56%)', 'hsl(199 89% 60%)', 'hsl(330 81% 65%)'][i] }}>
                <div className="strip"><span>phase_{String(i + 1).padStart(2, '0')}</span><span>{ph.gravity}</span></div>
                <div><div className="g">{ph.label}</div></div>
                <div><small>{ph.body}</small></div>
                <div style={{ marginTop: 'auto' }}><span className="mono" style={{ fontSize: '.78rem', color: 'var(--violet-text)' }}>→ {ph.focus}</span></div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="dark-sec" style={{ paddingTop: 84 }}>
        <div className="wrap">
          <p className="kicker">The method</p>
          <h2 className="big" style={{ fontSize: 'clamp(1.9rem, 3.6vw, 2.6rem)' }}>How Crew Mirror works</h2>
          <p className="muted" style={{ fontSize: '1.04rem' }}>No wearables, no uplink, no black box. Four steps, every day.</p>
        </div>
        <Story steps={STEPS} />
      </section>

      {/* ── NASA evidence ── */}
      <section id="evidence" className="section">
        <div className="wrap">
          <div className="split">
            <div>
              <p className="kicker"><Database size={13} style={{ verticalAlign: -2 }} /> NASA open science data</p>
              <h2 className="big">Why a personal baseline?</h2>
              <p className="sub">We downloaded the Inspiration4 crew blood tests from NASA’s Open Science Data Repository and asked: the day after landing, who changed?</p>
              <div className="grid g3" style={{ marginTop: 22 }}>
                <div><div className="stat-big" style={{ color: 'var(--violet-text)' }}>{h.outside_personal_range}</div><small>of {h.pairs} values left the person’s own pre-flight range</small></div>
                <div><div className="stat-big" style={{ color: 'var(--watch)' }}>{h.outside_personal_inside_population}</div><small>of those still looked “normal” on the population range</small></div>
                <div><div className="stat-big" style={{ color: 'var(--muted-fg)' }}>{h.outside_population_range}</div><small>were flagged by the population range at all</small></div>
              </div>
              <div className="row" style={{ marginTop: 24 }}>
                <button className="btn violet" onClick={() => open('evidence')}>Explore the evidence <ArrowRight /></button>
              </div>
              <p><small>Data are courtesy of the NASA Open Science Data Repository (OSD-569, OSD-575).</small></p>
            </div>
            <div className="alt">
              <div className="card" style={{ width: '100%', maxWidth: 420, borderWidth: 2, borderColor: 'var(--ink)', boxShadow: '-8px 8px 0 0 hsl(262 83% 66%)' }}>
                <div className="strip"><span>OSD-569 · {hgb.analyte.toLowerCase()}</span><span>{hgb.unit}</span></div>
                <AnalyteChart a={hgb} />
                <small>Each colour is one crew member. Shaded = their own pre-flight range; grey band = population range.</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Crew medical officer ── */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="split">
            <div>
              <p className="kicker"><Stethoscope size={13} style={{ verticalAlign: -2 }} /> For the crew medical officer</p>
              <h2 className="big">The whole crew at a glance.</h2>
              <p className="sub">Worst status first. Every alert carries the rule that fired, so the medical officer can check the reasoning — not trust a score.</p>
              <div className="stack" style={{ marginTop: 22 }}>
                {[
                  [Activity, 'Crew board', 'Usual / Watch / Act / No data for every astronaut, from the habitat server.'],
                  [ListChecks, 'Reasons, always', 'Baseline median, spread and z-score behind every flag.'],
                  [Radio, 'Delayed downlink', 'Messages to the Earth flight surgeon queue with 4–24 min Mars light-time.'],
                ].map(([Icon, t, d]) => {
                  const I = Icon as typeof Activity
                  return <div key={t as string} className="feature"><span className="feature-icon"><I /></span><div><b>{t as string}</b><p>{d as string}</p></div></div>
                })}
              </div>
            </div>
            <div className="alt">
              <div className="card" style={{ width: '100%', maxWidth: 400, padding: 0, borderWidth: 2, borderColor: 'var(--ink)', boxShadow: '-8px 8px 0 0 hsl(168 76% 50%)' }} aria-hidden>
                <div className="strip" style={{ margin: 0 }}><span>crew_board</span><span className="chip baseline" style={{ fontSize: '.62rem' }}>Day 96</span></div>
                {([['PLT', 'Pilot', 'act', 'Sleep 4.5 h · z −5.0'], ['MS1', 'Mission specialist', 'watch', 'Face width · z +2.3'], ['MS2', 'Medical officer', 'nodata', 'HR failed quality check'], ['CDR', 'Commander', 'usual', 'All within usual']] as const).map(([id, role, l, why]) => (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderTop: '1px solid var(--border)' }}>
                    <span style={{ width: 36, height: 36, borderRadius: 8, border: '2px solid var(--ink)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '.75rem', background: 'var(--teal)', color: '#04130f' }}>{id}</span>
                    <div style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: '.9rem' }}>{role}</b><br /><small className="mono" style={{ fontSize: '.72rem' }}>{why}</small></div>
                    <StatusChip level={l} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Safety & privacy ── */}
      <section id="safety" className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <p className="kicker">Safety & privacy by design</p>
          <h2 className="big">Built to be trusted far from Earth.</h2>
          <div className="grid g4" style={{ marginTop: 26 }}>
            {[
              [ShieldAlert, 'Danger signs first', 'Chest pain, stroke signs, sudden headache, nerve compression or impact → “Act now: contact the crew medical officer.” No exercises.'],
              [Brain, 'Rules, not AI', 'Deterministic triage and statistics. The same rules run in the browser and on the habitat server, tested against shared cases.'],
              [EyeOff, 'Video never leaves', 'Models run in a Web Worker on the device. Only derived numbers are stored or sent.'],
              [CloudOff, 'Works offline', 'Installable web app. Models, NASA evidence library and history are all on board.'],
              [ScanFace, 'No data ≠ fine', 'Bad light, movement or a hidden face shows “No data” — never a reassuring guess.'],
              [HeartPulse, 'Pattern, not diagnosis', 'Results are educational patterns. Prototype, not a medical device.'],
            ].map(([Icon, t, d]) => {
              const I = Icon as typeof Brain
              return (
                <div key={t as string} className="card">
                  <span className="feature-icon" style={{ marginBottom: 12 }}><I /></span>
                  <h3>{t as string}</h3>
                  <p className="muted" style={{ fontSize: '.9rem' }}>{d as string}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="dark-sec final">
        <div className="glyph">◐</div>
        <h2 style={{ fontSize: 'clamp(1.9rem, 3.6vw, 2.6rem)', marginTop: 20 }}>Run your first check.</h2>
        <p className="muted" style={{ fontSize: '1.04rem' }}>Try the demo crew, or start empty and build your own baseline in 7 days.</p>
        <div className="row" style={{ justifyContent: 'center', marginTop: 28 }}>
          <button className="btn primary" style={{ padding: '12px 26px', fontSize: '1rem' }} onClick={() => open('check')}>Start a daily check <ArrowRight /></button>
          <button className="btn outline-dark" onClick={() => open('medical')}>See the crew board</button>
        </div>
      </section>

      <footer className="site-footer">
        <div className="wrap">
          <span className="brand" style={{ fontSize: '.95rem' }}><Logo size={22} /> Crew Mirror</span>
          <span><b style={{ color: 'var(--watch)' }}>Prototype, not a medical device.</b> Team SYS-ASTRO · NASA Space Apps Seoul 2026 · MIT. Not endorsed by NASA.</span>
          <span>
            <a href="#/app/evidence">NASA data & references</a>
            <a href="#/app/today">Open app</a>
          </span>
        </div>
      </footer>
    </div>
  )
}
