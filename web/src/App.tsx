import { useEffect, useState } from 'react'
import {
  ArrowLeft, CalendarDays, ChevronRight, Database, Dumbbell, Footprints, HeartPulse, House, ListChecks, LogIn, PersonStanding,
  ScanFace, Settings as SettingsIcon, Stethoscope, TrendingUp,
} from 'lucide-react'
import { activeProfile, load, refreshOnline, setActiveCrew, useStore } from './data/store'
import { cloudConfigured } from './data/cloud'
import { Footer, Logo, ThemeToggle } from './components/ui'
import { Landing } from './site/Landing'
import { Auth } from './site/Auth'
import { Today } from './screens/Today'
import { DailyCheck } from './screens/DailyCheck'
import { Report } from './screens/Report'
import { Balance } from './screens/Balance'
import { Trends } from './screens/Trends'
import { Evidence } from './screens/Evidence'
import { Medical } from './screens/Medical'
import { Body } from './screens/Body'
import { Coach } from './screens/Coach'
import { Plan } from './screens/Plan'
import { CalendarPage } from './screens/Calendar'
import { Settings } from './screens/Settings'

const TABS = [
  { id: 'today', label: 'Today', icon: House, title: 'Today', group: 'Daily' },
  { id: 'check', label: 'Daily check', icon: ScanFace, title: 'Daily check', group: 'Daily' },
  { id: 'plan', label: 'Plan', icon: ListChecks, title: 'Today’s plan · exercise & food', group: 'Daily' },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, title: 'Calendar', group: 'Daily' },
  { id: 'body', label: '3D body', icon: PersonStanding, title: '3D body', group: 'Body' },
  { id: 'report', label: 'Report pain', icon: HeartPulse, title: 'Report pain or symptom', group: 'Body' },
  { id: 'coach', label: 'Exercise coach', icon: Dumbbell, title: 'Exercise coach', group: 'Body' },
  { id: 'balance', label: 'Balance', icon: Footprints, title: 'Balance · safe to walk?', group: 'Body' },
  { id: 'trends', label: 'Trends', icon: TrendingUp, title: 'Trends', group: 'Insights' },
  { id: 'evidence', label: 'NASA evidence', icon: Database, title: 'NASA evidence', group: 'Insights' },
  { id: 'medical', label: 'Medical officer', icon: Stethoscope, title: 'Crew medical officer', group: 'Crew' },
  { id: 'settings', label: 'Settings', icon: SettingsIcon, title: 'Settings', group: 'Crew' },
] as const
type Tab = (typeof TABS)[number]['id']

// Routes: "#/" landing, "#/login", "#/app/<tab>". Old "#<tab>" links still work.
function parse(): { page: 'landing' | 'login' | 'app'; tab: Tab } {
  const h = location.hash.replace(/^#\/?/, '')
  const isTab = (t: string): t is Tab => TABS.some((x) => x.id === t)
  if (h.startsWith('login')) return { page: 'login', tab: 'today' }
  if (h.startsWith('app')) {
    const t = h.split('/')[1] ?? 'today'
    return { page: 'app', tab: isTab(t) ? t : 'today' }
  }
  if (isTab(h)) return { page: 'app', tab: h }
  return { page: 'landing', tab: 'today' }
}

export default function App() {
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    void load()
    const onHash = () => { setRoute(parse()); window.scrollTo(0, 0) }
    addEventListener('hashchange', onHash)
    const t = setInterval(() => void refreshOnline(), 15000)
    return () => { removeEventListener('hashchange', onHash); clearInterval(t) }
  }, [])
  const go = (t: string) => { location.hash = `/app/${t}` }
  if (route.page === 'landing') return <Landing open={(t) => go(t ?? 'today')} />
  if (route.page === 'login') return <Auth done={() => go('today')} />
  return <Shell tab={route.tab} go={go} />
}

function Shell({ tab, go }: { tab: Tab; go: (t: string) => void }) {
  const s = useStore()
  const p = activeProfile(s)
  const cur = TABS.find((t) => t.id === tab)!
  const groups = [...new Set(TABS.map((t) => t.group))]
  const item = (t: (typeof TABS)[number], mobile = false) => (
    <a key={t.id} href={`#/app/${t.id}`} className="nav-item" aria-current={t.id === tab ? 'page' : undefined}>
      <t.icon />{t.label}
      {!mobile && t.id === tab && <ChevronRight size={14} className="badge" />}
    </a>
  )

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brandbar">
          <a className="brand" href="#/"><Logo /> Crew Mirror</a>
          <span className="pill" title={s.online ? 'Numbers sync to the habitat server' : 'Working on this device only; changes queue until the server is back'}>
            <span className={`dot${s.online ? ' on' : ''}`} />{s.online ? 'Link' : 'Solo'}
          </span>
        </div>
        <nav className="nav">
          {groups.map((g) => (
            <div key={g}>
              <div className="nav-label">{g}</div>
              {TABS.filter((t) => t.group === g).map((t) => item(t))}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          {cloudConfigured && !s.account && <a className="nav-item" href="#/login"><LogIn />Sign in</a>}
          {s.account && <div className="nav-item" style={{ cursor: 'default' }}><span className="dot on" />{s.account.callSign} · {s.account.mission}</div>}
          <a className="nav-item" href="#/"><ArrowLeft />Back to site</a>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <h1>{cur.title}</h1>
          <div className="spacer" />
          {s.crew.length > 0 && (
            <label className="pill crew-pick"><span className="hide-xs">Crew</span>
              <select value={p?.id} onChange={(e) => setActiveCrew(e.target.value)} style={{ padding: '2px 6px' }}>
                {s.crew.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.role}</option>)}
              </select>
            </label>
          )}
          <ThemeToggle />
        </header>
        <nav className="mobile-nav">
          <a className="nav-item" href="#/"><Logo size={18} /></a>
          {TABS.map((t) => item(t, true))}
        </nav>
        <main className="content">
          {!s.loaded ? <p>Loading…</p> : (
            <>
              {tab === 'today' && <Today go={go} />}
              {tab === 'check' && <DailyCheck key={p?.id} go={go} />}
              {tab === 'plan' && <Plan go={go} />}
              {tab === 'calendar' && <CalendarPage go={go} />}
              {tab === 'body' && <Body key={p?.id} go={go} />}
              {tab === 'report' && <Report key={p?.id} go={go} />}
              {tab === 'coach' && <Coach key={p?.id} go={go} />}
              {tab === 'balance' && <Balance key={p?.id} />}
              {tab === 'trends' && <Trends />}
              {tab === 'evidence' && <Evidence />}
              {tab === 'medical' && <Medical go={go} />}
              {tab === 'settings' && <Settings go={go} />}
            </>
          )}
        </main>
        <Footer />
      </div>
    </div>
  )
}
