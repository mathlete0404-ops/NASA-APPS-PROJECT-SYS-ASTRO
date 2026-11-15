import { useCallback, useEffect, useState } from 'react'
import {
  CalendarDays, ChevronDown, CircleHelp, Ellipsis, PanelLeftClose, PanelLeftOpen, Wifi, WifiOff, ChevronRight, Database, Dumbbell, Footprints, HeartPulse, House, ListChecks, LogIn, PawPrint, PersonStanding,
  ScanFace, Settings as SettingsIcon, Stethoscope, TrendingUp,
} from 'lucide-react'
import { activeProfile, load, refreshOnline, setActiveCrew, useStore } from './data/store'
import { cloudConfigured } from './data/cloud'
import { useReminderSync } from './data/notify'
import { Footer, Logo, ThemeToggle, useEscape } from './components/ui'
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
import { PetPage } from './screens/PetPage'
import { CalendarPage } from './screens/Calendar'
import { Settings } from './screens/Settings'
import { GuideBody, Welcome } from './screens/Welcome'
import { X } from 'lucide-react'

// Six places cover the daily job (check in, see the plan, look after the pet, say where it hurts). Everything else
// sits under More, so the sidebar and the phone tab bar stay short.
const TABS = [
  { id: 'today', label: 'Today', short: 'Today', icon: House, title: 'Today', group: 'main' },
  { id: 'check', label: 'Daily check', short: 'Check', icon: ScanFace, title: 'Daily check', group: 'main' },
  { id: 'plan', label: 'Plan', short: 'Plan', icon: ListChecks, title: 'Today’s plan', group: 'main' },
  { id: 'pet', label: 'Crew pet', short: 'Pet', icon: PawPrint, title: 'Crew pet', group: 'main' },
  { id: 'body', label: '3D body', short: 'Body', icon: PersonStanding, title: '3D body', group: 'main' },
  { id: 'report', label: 'Something hurts', short: 'Pain', icon: HeartPulse, title: 'Something hurts', group: 'main' },
  { id: 'calendar', label: 'Calendar', short: 'Calendar', icon: CalendarDays, title: 'Calendar', group: 'More' },
  { id: 'trends', label: 'Trends', short: 'Trends', icon: TrendingUp, title: 'Trends', group: 'More' },
  { id: 'coach', label: 'Exercise coach', short: 'Coach', icon: Dumbbell, title: 'Exercise coach', group: 'More' },
  { id: 'balance', label: 'Balance', short: 'Balance', icon: Footprints, title: 'Balance', group: 'More' },
  { id: 'evidence', label: 'NASA evidence', short: 'Evidence', icon: Database, title: 'NASA evidence', group: 'More' },
  { id: 'medical', label: 'Medical officer', short: 'Medical', icon: Stethoscope, title: 'Crew medical officer', group: 'More' },
  { id: 'settings', label: 'Settings', short: 'Settings', icon: SettingsIcon, title: 'Settings', group: 'footer' },
] as const
/** Phone tab bar: four main places plus More (Pet and Report pain live in More and on Today/Body). */
const PHONE_TABS = ['today', 'check', 'plan', 'body'] as const
type Tab = (typeof TABS)[number]['id']

// Routes: "#/login", "#/app/<tab>" ("#/" opens Today). Old "#<tab>" links still work.
function parse(): { page: 'login' | 'app'; tab: Tab } {
  const h = location.hash.replace(/^#\/?/, '')
  const isTab = (t: string): t is Tab => TABS.some((x) => x.id === t)
  if (h.startsWith('login')) return { page: 'login', tab: 'today' }
  if (h.startsWith('app')) {
    const t = h.split('/')[1] ?? 'today'
    return { page: 'app', tab: isTab(t) ? t : 'today' }
  }
  if (isTab(h)) return { page: 'app', tab: h }
  return { page: 'app', tab: 'today' }
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
  if (route.page === 'login') return <Auth done={() => go('today')} />
  return <Shell tab={route.tab} go={go} />
}

function Shell({ tab, go }: { tab: Tab; go: (t: string) => void }) {
  const s = useStore()
  const p = activeProfile(s)
  const [guide, setGuide] = useState(false)
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('crew-mirror:nav-collapsed') === '1' } catch { return false } })
  const [moreOpen, setMoreOpen] = useState(false)
  const [sheet, setSheet] = useState(false)
  useReminderSync()
  const closeAll = useCallback(() => { setSheet(false); setGuide(false) }, [])
  useEscape(closeAll, sheet || guide)
  useEffect(() => { setSheet(false) }, [tab])
  useEffect(() => {
    const open = () => setGuide(true)
    addEventListener('crew-mirror:guide', open)
    return () => removeEventListener('crew-mirror:guide', open)
  }, [])
  useEffect(() => { try { localStorage.setItem(`crew-mirror:seen:${tab}`, '1') } catch { /* ignore */ } }, [tab])
  if (s.loaded && !s.onboarded) return <Welcome go={go} />
  const cur = TABS.find((t) => t.id === tab)!
  const item = (t: (typeof TABS)[number], mobile = false) => (
    <a key={t.id} href={`#/app/${t.id}`} className="nav-item" aria-current={t.id === tab ? 'page' : undefined} title={collapsed && !mobile ? t.label : undefined}>
      <t.icon /><span className="nav-text">{t.label}</span>
      {!mobile && t.id === tab && <ChevronRight size={14} className="badge nav-text" />}
    </a>
  )
  const more = TABS.filter((t) => t.group === 'More')
  const moreActive = more.some((t) => t.id === tab)
  const toggleNav = () => setCollapsed((c) => { try { localStorage.setItem('crew-mirror:nav-collapsed', c ? '0' : '1') } catch { /* ignore */ } return !c })

  return (
    <div className={`shell${collapsed ? ' collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="brandbar">
          <a className="brand" href="#/app/today" title="Crew Mirror"><Logo /><span className="nav-text">Crew Mirror</span></a>
          <button className="btn ghost icon nav-toggle" onClick={toggleNav} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </button>
        </div>
        <nav className="nav">
          {TABS.filter((t) => t.group === 'main').map((t) => item(t))}
          <button className={`nav-item nav-more-btn${moreOpen || moreActive ? ' open' : ''}`} onClick={() => setMoreOpen((o) => !o)} title={collapsed ? 'More' : undefined} aria-expanded={moreOpen || moreActive}>
            <ChevronDown className="chev" /><span className="nav-text">More</span>
          </button>
          <div className={`nav-more${moreOpen || moreActive ? ' open' : ''}`}><div>{more.map((t) => item(t))}</div></div>
        </nav>
        <div className="side-foot">
          <a className="profile-chip" href="#/app/settings" aria-current={tab === 'settings' ? 'page' : undefined} title="Profile & settings">
            <span className="avatar">{(p?.id ?? '?').slice(0, 3)}</span>
            <span className="nav-text"><b>{p?.id ?? 'Profile'}</b><small>{s.account ? `Signed in · ${s.account.mission}` : 'Settings'}</small></span>
          </a>
          {cloudConfigured && !s.account && <a className="nav-item" href="#/login" title="Sign in"><LogIn /><span className="nav-text">Sign in to sync</span></a>}
          <button className="nav-item" onClick={() => window.dispatchEvent(new Event('crew-mirror:guide'))} title="How to use Crew Mirror"><CircleHelp /><span className="nav-text">How to use</span></button>
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
          <span className={`pill net${s.online ? ' on' : ''}`} title={s.online ? 'Connected to the habitat computer. Numbers sync.' : 'Not connected. Everything still works and is saved on this device.'}>
            {s.online ? <Wifi size={13} /> : <WifiOff size={13} />}<span className="hide-xs">{s.online ? 'Synced' : 'On device'}</span>
          </span>
          <span className="hide-phone"><ThemeToggle /></span>
        </header>
        <nav className="tabbar" aria-label="Main">
          {PHONE_TABS.map((id) => { const t = TABS.find((x) => x.id === id)!; return (
            <a key={id} href={`#/app/${id}`} aria-current={id === tab ? 'page' : undefined}><t.icon /><span>{t.short}</span></a>
          ) })}
          <button type="button" className={PHONE_TABS.some((id) => id === tab) ? '' : 'on'} aria-expanded={sheet} onClick={() => setSheet(true)}><Ellipsis /><span>More</span></button>
        </nav>
        <main className="content page-enter" key={tab}>
          {!s.loaded ? <p>Loading…</p> : (
            <>
              {tab === 'today' && <Today go={go} />}
              {tab === 'check' && <DailyCheck key={p?.id} go={go} />}
              {tab === 'plan' && <Plan go={go} />}
              {tab === 'pet' && <PetPage go={go} />}
              {tab === 'calendar' && <CalendarPage go={go} />}
              {tab === 'body' && <Body key={p?.id} go={go} />}
              {tab === 'report' && <Report key={p?.id} go={go} />}
              {tab === 'coach' && <Coach key={p?.id} go={go} />}
              {tab === 'balance' && <Balance key={p?.id} />}
              {tab === 'trends' && <Trends go={go} />}
              {tab === 'evidence' && <Evidence />}
              {tab === 'medical' && <Medical go={go} />}
              {tab === 'settings' && <Settings go={go} />}
            </>
          )}
        </main>
        <Footer />
      </div>
      {sheet && (
        <div className="modal sheet-wrap" role="dialog" aria-modal="true" aria-label="More" onClick={() => setSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" />
            <div className="sheet-grid">
              {TABS.filter((t) => !PHONE_TABS.some((id) => id === t.id)).map((t) => (
                <a key={t.id} href={`#/app/${t.id}`} className={`sheet-item${t.id === 'report' ? ' warn' : ''}`} aria-current={t.id === tab ? 'page' : undefined}><t.icon /><span>{t.label}</span></a>
              ))}
              <button type="button" className="sheet-item" onClick={() => { setSheet(false); setGuide(true) }}><CircleHelp /><span>How to use</span></button>
              {cloudConfigured && !s.account && <a className="sheet-item" href="#/login"><LogIn /><span>Sign in to sync</span></a>}
            </div>
          </div>
        </div>
      )}
      {guide && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="How to use Crew Mirror" onClick={() => setGuide(false)}>
          <div className="card modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="row between"><h2 style={{ margin: 0 }}>How to use Crew Mirror</h2><button className="btn ghost icon" onClick={() => setGuide(false)} title="Close"><X /></button></div>
            <GuideBody />
          </div>
        </div>
      )}
    </div>
  )
}
