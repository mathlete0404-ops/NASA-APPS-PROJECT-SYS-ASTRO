import { useState } from 'react'
import { ArrowLeft, ArrowRight, CloudOff, LogIn, UserPlus } from 'lucide-react'
import { cloudConfigured, resetPassword, signIn, signUp } from '../data/cloud'
import { Logo, ThemeToggle } from '../components/ui'

export function Auth({ done }: { done: () => void }) {
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [callSign, setCallSign] = useState('')
  const [role, setRole] = useState('Mission specialist')
  const [mission, setMission] = useState('')
  const [isCmo, setIsCmo] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try {
      if (mode === 'in') { await signIn(email, password); done() }
      else if (mode === 'up') {
        const r = await signUp(email, password, { call_sign: callSign.trim().toUpperCase(), role, mission_code: mission.trim().toUpperCase() || 'DEMO', cmo_requested: isCmo })
        if (r.needsConfirm) setMsg({ kind: 'ok', text: 'Check your email to confirm the account, then sign in.' })
        else done()
      } else { await resetPassword(email); setMsg({ kind: 'ok', text: 'If that email has an account, a reset link is on its way.' }) }
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message })
    } finally { setBusy(false) }
  }

  return (
    <div className="auth-wrap">
      <div className="side">
        <div className="gridbg" />
        <a className="brand" href="#/app/today" style={{ color: '#fff', position: 'relative' }}><Logo /> Crew Mirror</a>
        <div style={{ position: 'relative' }}>
          <p className="kicker">Your account</p>
          <h2 style={{ fontSize: '2.2rem', color: '#fff' }}>Your baseline follows you — from pre-flight to landing.</h2>
          <p style={{ color: '#cbd5e1', maxWidth: 420 }}>Sign in to back up your derived numbers and share them with your crew medical officer. Video never leaves your device, and the app keeps working offline without an account.</p>
        </div>
        <small style={{ color: '#64748b', position: 'relative' }}>Prototype, not a medical device.</small>
      </div>
      <div className="form">
        <div className="auth-card">
          <div className="row between" style={{ marginBottom: 18 }}>
            <a className="btn ghost small" href="#/app/today"><ArrowLeft /> Back</a>
            <ThemeToggle />
          </div>
          <h1 style={{ fontSize: '1.8rem' }}>{mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create your crew account' : 'Reset password'}</h1>
          {!cloudConfigured ? (
            <div className="stack">
              <div className="notice">Cloud accounts are not configured on this build. Everything works on this device without an account.</div>
              <button className="btn primary" onClick={done}><CloudOff /> Continue offline</button>
              <small className="muted">Developers: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in web/.env.local and apply supabase/migrations.</small>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="field"><label htmlFor="em">Email</label><input id="em" type="text" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              {mode !== 'reset' && <div className="field"><label htmlFor="pw">Password</label><input id="pw" type="password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} style={{ background: 'var(--card)', color: 'var(--foreground)', border: '1.5px solid var(--border)', borderRadius: 8, font: 'inherit' }} /></div>}
              {mode === 'up' && (
                <>
                  <div className="field"><label htmlFor="cs">Call sign (no real names)</label><input id="cs" type="text" required maxLength={12} placeholder="e.g. MS3" value={callSign} onChange={(e) => setCallSign(e.target.value)} /></div>
                  <div className="field"><label htmlFor="ro">Role</label>
                    <select id="ro" value={role} onChange={(e) => setRole(e.target.value)}>{['Commander', 'Pilot', 'Mission specialist', 'Flight engineer', 'Payload specialist'].map((r) => <option key={r}>{r}</option>)}</select>
                  </div>
                  <div className="field"><label htmlFor="mc">Mission code</label><input id="mc" type="text" maxLength={16} placeholder="shared by your crew, e.g. ARES-1" value={mission} onChange={(e) => setMission(e.target.value)} /></div>
                  <label className="row" style={{ marginTop: 12 }}><input type="checkbox" checked={isCmo} onChange={(e) => setIsCmo(e.target.checked)} /> Request crew-medical-officer access <small className="muted">(a mission admin approves it)</small></label>
                </>
              )}
              {msg && <div className={`notice ${msg.kind}`} style={{ marginTop: 14 }}>{msg.text}</div>}
              <button className="btn primary" type="submit" disabled={busy} style={{ width: '100%', marginTop: 18, padding: 11 }}>
                {mode === 'in' ? <><LogIn /> Sign in</> : mode === 'up' ? <><UserPlus /> Create account</> : 'Send reset link'}
              </button>
              <div className="row between" style={{ marginTop: 14, fontSize: '.88rem' }}>
                {mode === 'in' ? <a href="#/login" onClick={(e) => { e.preventDefault(); setMode('up'); setMsg(null) }}>New here? Create an account</a> : <a href="#/login" onClick={(e) => { e.preventDefault(); setMode('in'); setMsg(null) }}>Have an account? Sign in</a>}
                {mode === 'in' && <a href="#/login" onClick={(e) => { e.preventDefault(); setMode('reset'); setMsg(null) }}>Forgot password?</a>}
              </div>
              <button type="button" className="btn ghost" style={{ marginTop: 18, width: '100%' }} onClick={done}>Continue without an account <ArrowRight /></button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
