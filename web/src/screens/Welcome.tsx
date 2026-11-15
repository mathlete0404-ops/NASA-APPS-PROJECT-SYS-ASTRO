// First-open setup: who you are (stored on this device — no account needed), how the
// app works, and the first step. Also exports the Guide shown from "How to use Crew Mirror".
import { useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, CloudOff, Dumbbell, HeartPulse, ListChecks, PersonStanding, ScanFace, Shield, Stethoscope } from 'lucide-react'
import { createProfile } from '../data/store'
import { loadReminderSettings, requestPermission, saveReminderSettings } from '../data/notify'
import { PHASES, type Phase } from '../content/mission'
import { Footer, Logo, StatusChip } from '../components/ui'

const today = () => new Date().toISOString().slice(0, 10)
const ROLES = ['Commander', 'Pilot', 'Mission specialist', 'Flight engineer', 'Payload specialist', 'Crew medical officer']
const PHASE_HELP: Record<Phase, string> = {
  preflight: 'The app learns your normal on Earth.',
  transit: 'In orbit or on the way.',
  landing: 'Balance and strength are checked again.',
  surface: 'Partial gravity.',
  return: 'Recovering after the mission.',
}

export function StatusLegend() {
  return (
    <div className="stack" style={{ marginTop: 6 }}>
      {([
        ['baseline', 'Learning', 'Your first 7 days. The app is learning what is normal for you.'],
        ['usual', 'Usual', 'Within your own normal range.'],
        ['watch', 'Watch', 'Clearly different from your normal. Check again tomorrow.'],
        ['act', 'Act', 'Far from your normal, or Watch three days in a row. Tell the crew medical officer.'],
        ['nodata', 'No data', 'The measurement was not good enough (light, movement). Never shown as “fine”.'],
      ] as const).map(([lvl, , text]) => (
        <div key={lvl} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
          <span style={{ minWidth: 92 }}><StatusChip level={lvl} /></span>
          <span style={{ fontSize: '.92rem' }}>{text}</span>
        </div>
      ))}
    </div>
  )
}

const PAGES: [typeof ScanFace, string, string][] = [
  [ScanFace, 'Daily check', 'Two minutes each morning: a face scan (heart rate, breathing, tiredness, puffiness) and how you slept and feel.'],
  [ListChecks, 'Plan', 'Today’s exercise and food, with the reason for each item.'],
  [CalendarDays, 'Calendar', 'Your checks, pain reports, workouts and mission events by day.'],
  [PersonStanding, '3D body', 'Explore your body. Anything that needs attention lights up.'],
  [HeartPulse, 'Report pain', 'Tap or point at where it hurts. The app finds the likely source and tells you what to do.'],
  [Dumbbell, 'Exercise coach', 'The camera counts reps and checks your form.'],
  [Stethoscope, 'Medical officer', 'The whole crew at a glance, and messages to Earth.'],
]

export function GuideBody() {
  return (
    <div className="stack">
      <div>
        <p className="kicker">Every day</p>
        <p>Do the <b>daily check</b> once a day, then follow your <b>plan</b>. When something hurts, use <b>Report pain</b>.</p>
      </div>
      <div className="grid g2">
        {PAGES.map(([I, name, text]) => (
          <div key={name} className="feature"><span className="feature-icon"><I /></span><div><b>{name}</b><p>{text}</p></div></div>
        ))}
      </div>
      <div>
        <p className="kicker">What the colours mean</p>
        <StatusLegend />
      </div>
      <p className="muted" style={{ fontSize: '.88rem' }}><Shield size={14} style={{ verticalAlign: -2 }} /> Camera video stays on this device; only numbers are saved. After the first load it works without internet. Results are patterns, not diagnoses. Prototype, not a medical device.</p>
    </div>
  )
}

export function Welcome({ go }: { go: (t: string) => void }) {
  const [step, setStep] = useState(0)
  const [callSign, setCallSign] = useState('')
  const [role, setRole] = useState('Mission specialist')
  const [phase, setPhase] = useState<Phase>('preflight')
  const [launch, setLaunch] = useState(today())
  const [weightless, setWeightless] = useState(0)
  const [mass, setMass] = useState('')
  const [remind, setRemind] = useState(false)
  const valid = /^[A-Z0-9-]{2,12}$/.test(callSign)

  const finish = (next: string) => {
    createProfile({
      id: callSign, role, phase, launchDate: launch, transitDays: weightless,
      massKg: mass ? +mass : undefined, scanSeconds: 60, isCmo: role === 'Crew medical officer',
    })
    if (remind) {
      saveReminderSettings({ ...loadReminderSettings(), enabled: true })
      void requestPermission() // optional; setup carries on whatever the answer
    }
    go(next)
  }

  return (
    <div className="welcome">
      <div className="welcome-card card">
        <div className="row between" style={{ marginBottom: 14 }}>
          <span className="brand"><Logo /> Crew Mirror</span>
          <span className="steps" style={{ margin: 0 }}>{[0, 1, 2, 3].map((i) => <span key={i} className={i === step ? 'on' : i < step ? 'done' : ''}>{i + 1}</span>)}</span>
        </div>

        {step === 0 && (
          <div className="stack">
            <h1 style={{ fontSize: '1.9rem' }}>A two-minute health check that knows <span style={{ color: 'var(--violet-text)' }}>your</span> normal.</h1>
            <p className="muted">Crew Mirror compares you with your own normal, not with an average person. Small changes show up early, with a next step for each.</p>
            <div className="stack">
              <div className="feature"><span className="feature-icon"><ScanFace /></span><div><b>Daily check</b><p>A face scan and a few questions each morning.</p></div></div>
              <div className="feature"><span className="feature-icon"><HeartPulse /></span><div><b>When something hurts</b><p>Point to it. See the likely cause and what to do.</p></div></div>
              <div className="feature"><span className="feature-icon"><CloudOff /></span><div><b>Works offline</b><p>After the first load, it runs on this device. Camera video never leaves it.</p></div></div>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn primary" onClick={() => setStep(1)}>Set up my profile <ArrowRight /></button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="stack">
            <div><p className="kicker">Who are you?</p><h2>Your crew profile</h2><p className="muted" style={{ fontSize: '.9rem' }}>Saved on this device only. Use your call sign, not your real name.</p></div>
            <div className="field"><label htmlFor="cs">Call sign</label>
              <input id="cs" type="text" autoFocus maxLength={12} placeholder="e.g. MS3" value={callSign} onChange={(e) => setCallSign(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))} />
              <small className="muted">2–12 letters or numbers.</small>
            </div>
            <div className="field"><label htmlFor="ro">Role</label><select id="ro" value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></div>
            <div className="field">
              <label>Where are you in the mission?</label>
              <div className="stack" style={{ marginTop: 4 }}>
                {(Object.keys(PHASES) as Phase[]).map((ph) => (
                  <button key={ph} type="button" className={`problem${phase === ph ? ' on' : ''}`} onClick={() => setPhase(ph)} style={{ padding: 9 }}>
                    <span style={{ flex: 1 }}><b>{PHASES[ph].label}</b><br /><small>{PHASE_HELP[ph]}</small></span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid g2">
              <div className="field"><label htmlFor="ld">{phase === 'preflight' ? 'Planned launch date' : 'Launch date'}</label><input id="ld" type="date" value={launch} onChange={(e) => setLaunch(e.target.value)} /></div>
              {(phase === 'landing' || phase === 'surface' || phase === 'return') && (
                <div className="field"><label htmlFor="wd">Time weightless (days)</label><input id="wd" type="number" min={0} value={weightless} onChange={(e) => setWeightless(+e.target.value)} /></div>
              )}
              <div className="field"><label htmlFor="ms">Body mass (optional)</label><input id="ms" type="number" step="0.1" placeholder="kg" value={mass} onChange={(e) => setMass(e.target.value)} /></div>
            </div>
            <div className="row between" style={{ marginTop: 6 }}>
              <button className="btn ghost" onClick={() => setStep(0)}><ArrowLeft /> Back</button>
              <button className="btn primary" disabled={!valid} onClick={() => setStep(2)}>Continue <ArrowRight /></button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="stack">
            <div><p className="kicker">How it works</p><h2>It learns your normal first</h2></div>
            <p>For your <b>first 7 days</b> the app is learning what is normal for you, so results show as <StatusChip level="baseline" />. After that, every measurement is compared with your own range:</p>
            <StatusLegend />
            <p className="muted" style={{ fontSize: '.9rem' }}>Danger signs (chest pain, stroke signs, a sudden severe headache…) always go straight to the crew medical officer. Results are patterns, not diagnoses.</p>
            <div className="row between">
              <button className="btn ghost" onClick={() => setStep(1)}><ArrowLeft /> Back</button>
              <button className="btn primary" onClick={() => setStep(3)}>Continue <ArrowRight /></button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="stack">
            <div><p className="kicker">You’re set, {callSign}</p><h2>Start with today’s check</h2></div>
            <p>It takes about two minutes: sit facing the screen in even light for a one-minute face scan, then answer four quick questions.</p>
            <label className="row" style={{ gap: 8, fontSize: '.92rem', cursor: 'pointer' }}>
              <input type="checkbox" className="switch" checked={remind} onChange={(e) => setRemind(e.target.checked)} />
              Remind me each morning at 08:00
            </label>
            <div className="row">
              <button className="btn primary" onClick={() => finish('check')}><ScanFace /> Start today’s check</button>
              <button className="btn" onClick={() => finish('today')}>Go to my home screen</button>
            </div>
            <button className="btn ghost small" style={{ alignSelf: 'flex-start' }} onClick={() => setStep(2)}><ArrowLeft /> Back</button>
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
