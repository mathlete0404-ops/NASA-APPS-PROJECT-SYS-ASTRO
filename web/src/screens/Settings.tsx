import { useEffect, useId, useState } from 'react'
import { Bell, Cloud, Database, Download, LogOut, Moon, Rocket, Salad, ScanFace, Server, Shield, User } from 'lucide-react'
import { activeProfile, exportData, missionDay, resetEmpty, updateProfile, useStore } from '../data/store'
import { cloudConfigured, signOut } from '../data/cloud'
import { api } from '../data/api'
import { PHASES, type Phase } from '../content/mission'
import { DEFAULT_TARGETS, type Targets } from '../content/nutrition'
import { useTheme } from '../components/ui'
import { latestMass } from '../engine/plan'
import { checkPermission, isNative, requestPermission, saveReminderSettings, sendReminderNow, useReminderSettings, type NotifyPermission } from '../data/notify'

function Section({ icon: I, title, children }: { icon: typeof User; title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="card-h"><span className="ic"><I /></span><h3>{title}</h3></div>
      <div className="set-rows">{children}</div>
    </div>
  )
}
const Row = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => {
  const id = useId()
  return (
    <div className="set-row">
      <div className="set-label"><b id={id}>{label}</b>{hint && <small>{hint}</small>}</div>
      <div className="set-ctrl" role="group" aria-labelledby={id}>{children}</div>
    </div>
  )
}

const PERM_TEXT: Record<NotifyPermission, string> = {
  granted: 'Notifications allowed',
  denied: isNative()
    ? 'Blocked in system settings: turn them on in Settings › Notifications › Crew Mirror'
    : 'Blocked in browser settings: allow notifications for this site',
  prompt: 'Not allowed yet. Turn reminders on to allow them.',
  unsupported: 'Not supported in this browser',
}

function RemindersSection() {
  const r = useReminderSettings()
  const [perm, setPerm] = useState<NotifyPermission | null>(null)
  const [sent, setSent] = useState<'ok' | 'fail' | null>(null)
  useEffect(() => {
    const refresh = () => void checkPermission().then(setPerm)
    refresh()
    // Coming back from the system settings app.
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])
  const toggle = async (on: boolean) => {
    saveReminderSettings({ ...r, enabled: on })
    if (on) setPerm(await requestPermission())
  }
  const sendNow = async () => {
    const ok = await sendReminderNow()
    setPerm(await checkPermission())
    setSent(ok ? 'ok' : 'fail')
  }
  return (
    <Section icon={Bell} title="Reminders">
      <Row label="Daily check reminder" hint="A reminder each morning to do your 2-minute check.">
        <input type="checkbox" className="switch" aria-label="Daily check reminder" checked={r.enabled} onChange={(e) => void toggle(e.target.checked)} />
      </Row>
      <Row label="Time">
        <input type="time" aria-label="Reminder time" value={r.time} disabled={!r.enabled} onChange={(e) => { if (e.target.value) saveReminderSettings({ ...r, time: e.target.value }) }} />
      </Row>
      <Row label="Evening nudge if not done" hint="A second reminder at 20:00 if today’s check isn’t done.">
        <input type="checkbox" className="switch" aria-label="Evening nudge if not done" checked={r.nudge} disabled={!r.enabled} onChange={(e) => saveReminderSettings({ ...r, nudge: e.target.checked })} />
      </Row>
      <Row label="Status">
        {perm && <span className={`chip ${perm === 'granted' ? 'usual' : perm === 'denied' ? 'act' : 'nodata'}`}>{perm === 'granted' ? 'allowed' : perm === 'denied' ? 'blocked' : perm === 'prompt' ? 'not asked' : 'not supported'}</span>}
      </Row>
      {perm && <small className="muted" data-testid="notify-status">{PERM_TEXT[perm]}</small>}
      <button className="btn small" disabled={perm === 'unsupported' || perm === 'denied'} onClick={() => void sendNow()}><Bell /> Send a reminder now</button>
      {sent === 'ok' && <small className="muted">Sent. It should appear in a moment.</small>}
      {sent === 'fail' && <small className="muted">The reminder could not be shown. Check that notifications are allowed.</small>}
      {!isNative() && <small className="muted">On the web, reminders appear only while Crew Mirror is open. The iPhone app reminds you even when it’s closed.</small>}
    </Section>
  )
}

export function Settings({ go }: { go: (t: string) => void }) {
  const s = useStore()
  const p = activeProfile(s)
  const { dark, toggle } = useTheme()
  const [confirmWipe, setConfirmWipe] = useState(false)
  if (!p) return null
  const t: Targets = { ...DEFAULT_TARGETS, ...p.targets }
  const setT = (k: keyof Targets, v: number) => updateProfile({ ...p, targets: { ...p.targets, [k]: v } })
  const scaleMass = latestMass(s, p.id)

  const download = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([exportData()], { type: 'application/json' }))
    a.download = `crew-mirror-${p.id}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }

  return (
    <div className="settings-grid">
      <Section icon={User} title="Profile">
        <Row label="Call sign" hint="We store call signs only, never real names."><b className="mono">{p.id}</b></Row>
        <Row label="Role"><input type="text" value={p.role} onChange={(e) => updateProfile({ ...p, role: e.target.value })} /></Row>
        <Row label="Body mass" hint={scaleMass ? `Latest scale/SLAMMD reading ${scaleMass} kg is used for targets.` : 'Used for food targets until a scale reading exists.'}>
          <input type="number" step="0.1" min={30} max={200} value={p.massKg ?? ''} placeholder="kg" onChange={(e) => updateProfile({ ...p, massKg: e.target.value ? +e.target.value : undefined })} style={{ width: 90 }} /> kg
        </Row>
        <Row label="Height"><input type="number" min={120} max={220} value={p.heightCm ?? ''} placeholder="cm" onChange={(e) => updateProfile({ ...p, heightCm: e.target.value ? +e.target.value : undefined })} style={{ width: 90 }} /> cm</Row>
        {s.account && <Row label="Mission"><span className="mono">{s.account.mission}{s.account.isCmo ? ' · medical officer' : ''}</span></Row>}
      </Section>

      <RemindersSection />

      <Section icon={Rocket} title="Mission">
        <Row label="Phase" hint={PHASES[p.phase].focus}>
          <select value={p.phase} onChange={(e) => updateProfile({ ...p, phase: e.target.value as Phase, transitDays: p.phase === 'transit' ? Math.max(0, missionDay(p)) : p.transitDays })}>
            {Object.values(PHASES).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </Row>
        <Row label="Launch date" hint="In flight, time weightless is counted from this date."><input type="date" value={p.launchDate} onChange={(e) => updateProfile({ ...p, launchDate: e.target.value })} /></Row>
        {!PHASES[p.phase].microgravity && p.phase !== 'preflight' && (
          <Row label="Time weightless (days)" hint="Used for the bone-loss estimate: bony pain is treated more carefully after a long flight."><input type="number" min={0} value={p.transitDays} onChange={(e) => updateProfile({ ...p, transitDays: +e.target.value })} style={{ width: 90 }} /></Row>
        )}
        <small className="muted">Phase changes which tests are offered (no balance tests while weightless), how cautiously bony pain is treated, and the exercise plan.</small>
      </Section>

      <Section icon={Salad} title="Nutrition targets">
        {([
          ['kcalPerKg', 'Energy', 'kcal / kg / day', 1], ['proteinPerKg', 'Protein', 'g / kg / day', 0.1], ['calciumMg', 'Calcium', 'mg / day', 50],
          ['vitDug', 'Vitamin D', 'µg / day', 1], ['sodiumMaxMg', 'Sodium (max)', 'mg / day', 100], ['potassiumMg', 'Potassium', 'mg / day', 100], ['fluidMlPerKg', 'Fluid', 'mL / kg / day', 1], ['fluidMl', 'Fluid (minimum)', 'mL / day', 100],
        ] as [keyof Targets, string, string, number][]).map(([k, label, unit, step]) => (
          <Row key={k} label={label} hint={unit}><input type="number" step={step} value={t[k]} onChange={(e) => setT(k, +e.target.value)} style={{ width: 100 }} /></Row>
        ))}
        <p className="muted" style={{ fontSize: '.85rem' }}>Defaults follow NASA's exploration nutrition requirements (JSC-67378): protein 1.2–1.8 g/kg, calcium 1000–1200 mg, vitamin D 25 µg, sodium 1500–2300 mg, fluid 32 mL/kg. Your crew nutritionist can adjust them.</p>
        <button className="btn small" onClick={() => updateProfile({ ...p, targets: undefined })}>Reset to defaults</button>
      </Section>

      <Section icon={ScanFace} title="Measurements">
        <Row label="Face scan length" hint="60 s gives breathing rate and a steadier heart-rate estimate.">
          <select value={p.scanSeconds ?? 30} onChange={(e) => updateProfile({ ...p, scanSeconds: +e.target.value as 30 | 60 })}><option value={30}>30 s (quick)</option><option value={60}>60 s (best)</option></select>
        </Row>
        <Row label="Baseline" hint="First 7 days with a good measurement; one value per day."><span className="mono">7 days</span></Row>
        <Row label="Status rule" hint="|z| > 2 Watch · |z| > 3 or Watch 3 days in a row → Act · failed quality → No data"><span className="mono">fixed</span></Row>
      </Section>

      <Section icon={Moon} title="Appearance">
        <Row label="Theme"><button className="btn small" onClick={toggle}>{dark ? 'Switch to light' : 'Switch to dark'}</button></Row>
      </Section>

      <Section icon={Cloud} title="Account & cloud sync">
        {!cloudConfigured ? <p className="muted">Cloud accounts aren’t set up in this build. Everything is stored on this device.</p>
          : s.account ? (
            <>
              <Row label="Signed in" hint={s.account.email}><span className="chip usual">synced</span></Row>
              <button className="btn" onClick={() => void signOut()}><LogOut /> Sign out</button>
            </>
          ) : <button className="btn primary" onClick={() => { location.hash = '/login' }}>Sign in or create account</button>}
        <small className="muted">Only derived numbers sync. A crew medical officer can read the crew of the same mission (row-level security).</small>
      </Section>

      <Section icon={Server} title="Habitat server">
        <Row label="Status" hint={`Endpoint ${api.base}`}><span className={`chip ${s.online ? 'usual' : 'nodata'}`}>{s.online ? 'online' : 'offline'}</span></Row>
        <small className="muted">The spacecraft computer. When it is unreachable, writes wait in an outbox on this device.</small>
      </Section>

      <Section icon={Database} title="Data on this device">
        <Row label="Export everything" hint="JSON of your numbers, reports, workouts, food and calendar."><button className="btn small" onClick={download}><Download /> Export</button></Row>
        <Row label="Start fresh" hint="Erase this device and build your own baseline.">
          {confirmWipe ? <><button className="btn small danger" onClick={() => { void resetEmpty(); setConfirmWipe(false); go('today') }}>Erase now</button><button className="btn small" onClick={() => setConfirmWipe(false)}>Cancel</button></>
            : <button className="btn small" onClick={() => setConfirmWipe(true)}>Erase…</button>}
        </Row>
      </Section>

      <Section icon={Shield} title="Privacy & safety">
        <p style={{ fontSize: '.9rem' }}>Camera video is processed on this device and never stored or sent. Only derived numbers (e.g. “63 bpm”) are kept. Triage uses fixed rules, not AI, and every result shows its reasons.</p>
        <p style={{ fontSize: '.9rem' }}><b>Prototype, not a medical device.</b> Results are patterns, never diagnoses.</p>
        <small className="muted">3D anatomy: Z-Anatomy (CC BY-SA 4.0) from BodyParts3D (CC BY-SA 2.1 JP). On-device vision: MediaPipe (Apache-2.0).</small>
      </Section>
    </div>
  )
}
