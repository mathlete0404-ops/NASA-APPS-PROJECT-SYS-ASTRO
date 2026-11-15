// Homepage (#/): what Crew Mirror is, why it matters, how it works, what it does, how we know it
// works, and how it stays safe. The app itself lives at #/app. Screenshots are of the real app.
import { useEffect, useRef } from 'react'
import {
  Activity, ArrowRight, BellRing, Check, CloudOff, Code2, Dumbbell, EyeOff, Footprints, HeartPulse, PawPrint, Play,
  Radiation, ScanFace, ShieldAlert, Smartphone, Stethoscope, UtensilsCrossed,
} from 'lucide-react'
import { Logo, ThemeToggle } from '../components/ui'

const BASE = import.meta.env.BASE_URL
const APP = '#/app/today'
const FILM = BASE + 'ad/'
const CODE = 'https://github.com/mathlete0404-ops/NASA-APPS-PROJECT-SYS-ASTRO'
const shot = (n: string) => `${BASE}home/${n}.webp`

/** Fade sections in as they scroll into view (skipped for reduced motion). */
function useReveal() {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const els = root.current?.querySelectorAll('.hp-reveal') ?? []
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      els.forEach((e) => e.classList.add('in')); return
    }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }), { rootMargin: '0px 0px -8% 0px' })
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [])
  return root
}

const Phone = ({ src, alt, className = '' }: { src: string; alt: string; className?: string }) => (
  <div className={`hp-phone ${className}`}><div className="hp-phone-screen"><img src={src} alt={alt} loading="lazy" /></div></div>
)

export function Home() {
  const root = useReveal()
  useEffect(() => { document.title = 'Crew Mirror · Your health, measured against you' }, [])
  return (
    <div className="hp" ref={root}>
      <header className="hp-nav">
        <a className="hp-brand" href="#/"><Logo size={26} /><span>Crew Mirror</span></a>
        <nav className="hp-links">
          <a href="#why" onClick={(e) => { e.preventDefault(); document.getElementById('why')?.scrollIntoView({ behavior: 'smooth' }) }}>Why</a>
          <a href="#how" onClick={(e) => { e.preventDefault(); document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' }) }}>How it works</a>
          <a href="#features" onClick={(e) => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }) }}>Features</a>
          <a href="#proof" onClick={(e) => { e.preventDefault(); document.getElementById('proof')?.scrollIntoView({ behavior: 'smooth' }) }}>Proof</a>
        </nav>
        <div className="hp-nav-r">
          <ThemeToggle onDark />
          <a className="btn primary small" href={APP}>Open the app <ArrowRight /></a>
        </div>
      </header>

      {/* ------------------------------------------------------------ hero */}
      <section className="hp-hero">
        <div className="hp-hero-in">
          <div className="hp-hero-copy">
            <p className="hp-kicker">NASA Space Apps Challenge 2026 · Seoul · Team SYS-ASTRO</p>
            <h1>Your health,<br />measured against <em>you.</em></h1>
            <p className="hp-lede">Crew Mirror is a two-minute daily health check for astronauts far from Earth. It uses only the camera of the laptop, tablet or iPhone already on board, compares every reading with your own normal, and tells you what to do today. No wearables. No signal needed.</p>
            <div className="hp-cta">
              <a className="btn primary" href={APP}><ScanFace /> Open the app</a>
              <a className="btn hp-btn-dark" href={FILM}><Play /> Watch the 30-second film</a>
              <a className="hp-textlink" href={CODE} target="_blank" rel="noreferrer"><Code2 size={16} /> Code on GitHub</a>
            </div>
            <ul className="hp-telemetry">
              <li><span>Signal delay to Earth</span><b>up to 22 min</b></li>
              <li><span>Works offline</span><b>100%</b></li>
              <li><span>Video leaves the device</span><b>never</b></li>
            </ul>
          </div>
          <div className="hp-hero-art" aria-hidden="true">
            <Phone src={shot('today')} alt="" className="hp-phone-main" />
            <div className="hp-float hp-float-a"><span className="chip watch">Watch</span> You slept less than usual <small>5.8 h · usually 7 h</small></div>
            <div className="hp-float hp-float-b"><HeartPulse size={16} /> Heart rate <b>58 bpm</b> <span className="chip usual">Usual</span></div>
            <div className="hp-float hp-float-c"><Radiation size={16} /> Space weather <b>Quiet</b></div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ why */}
      <section className="hp-sec" id="why">
        <div className="hp-wrap">
          <p className="hp-kicker hp-reveal">Why it matters</p>
          <h2 className="hp-reveal">Far from Earth, the doctor is a message away.</h2>
          <div className="hp-stats">
            <div className="hp-stat card hp-reveal"><b>22 min</b><p>for a message to reach Earth from Mars at its farthest. A live call with a flight surgeon is impossible, and there is often no doctor on board.</p></div>
            <div className="hp-stat card hp-reveal"><b>~280×</b><p>Earth’s natural radiation background: about 1.8 mSv a day, measured by NASA’s Curiosity rover on the way to Mars. A solar storm can raise it within hours.</p></div>
            <div className="hp-stat card hp-reveal"><b>55 of 137</b><p>Inspiration4 blood values had left each astronaut’s own normal the day after landing. Population ranges flagged only 5. So Crew Mirror compares you with you.</p></div>
          </div>
          <p className="hp-source hp-reveal">Sources: NASA OSDR studies OSD-569 and OSD-575; Zeitlin et al. 2013 (Curiosity RAD).</p>
        </div>
      </section>

      {/* ------------------------------------------------------------ how */}
      <section className="hp-sec hp-alt" id="how">
        <div className="hp-wrap">
          <p className="hp-kicker hp-reveal">How it works</p>
          <h2 className="hp-reveal">A two-minute loop, every morning.</h2>
          <ol className="hp-steps">
            {([
              [ScanFace, 'Scan', 'Sit in front of the screen for a short face scan, then answer four quick questions about mood, energy and sleep.'],
              [Activity, 'Compare', 'Your first seven checks become your normal. Each new reading is marked Usual, Watch or Act, always with the reason.'],
              [Dumbbell, 'Plan', 'Today’s exercise, food and sleep advice adapts to what changed, and to where you are in the mission.'],
              [ShieldAlert, 'Act', 'Danger signs go straight to the crew medical officer. Radiation storms come with clear shelter and EVA actions.'],
            ] as const).map(([Icon, t, d], i) => (
              <li key={t} className="hp-step card hp-reveal" style={{ transitionDelay: `${i * 70}ms` }}>
                <span className="hp-step-n">0{i + 1}</span><span className="ic"><Icon /></span>
                <h3>{t}</h3><p>{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------ features */}
      <section className="hp-sec" id="features">
        <div className="hp-wrap">
          <p className="hp-kicker hp-reveal">What it does</p>
          <h2 className="hp-reveal">Everything a crew needs, in one app.</h2>
          <div className="hp-showcase">
            <article className="hp-show card hp-reveal">
              <div className="hp-show-t"><span className="ic"><Stethoscope /></span><h3>Something hurts? Point to it.</h3>
                <p>Danger signs always come first. Then show where it hurts on a 3D body with 1,518 muscles, bones, nerves and discs, by tapping or by pointing a finger at the camera. A referred-pain finder shows where it may really come from. Patterns, never diagnoses.</p></div>
              <Phone src={shot('body')} alt="The 3D body showing the muscle layer" />
            </article>
            <article className="hp-show card hp-reveal">
              <div className="hp-show-t"><span className="ic"><UtensilsCrossed /></span><h3>Space food, counted properly.</h3>
                <p>Targets follow NASA’s exploration nutrition requirements and scale with body mass. The menu uses real ISS food types, and you can photograph a pouch: its label is read on the device in under a second.</p></div>
              <Phone src={shot('scan')} alt="Scanning a beef brisket pouch" />
            </article>
            <article className="hp-show card hp-reveal">
              <div className="hp-show-t"><span className="ic"><PawPrint /></span><h3>A crew pet that grows when you show up.</h3>
                <p>It hatches after three daily checks and needs feeding, exercise and check-ins, like a Tamagotchi. It rewards showing up and honest pain reports, and never reacts to health results.</p></div>
              <Phone src={shot('pet')} alt="The crew pet with its needs" />
            </article>
          </div>
          <div className="hp-grid">
            {([
              [ScanFace, 'Camera face scan', 'Heart rate from skin colour (rPPG), breathing, blinking and eye closure, and face width for fluid shifting to the head.'],
              [Radiation, 'Radiation storms', 'Live NOAA proton data on the official S1–S5 scale, with shelter and EVA actions. Keeps the last reading offline.'],
              [Footprints, 'Balance on the ground', 'After landing or on the Moon or Mars: “Is it safe to walk or start an EVA?” Switched off while weightless.'],
              [Dumbbell, 'Exercise coach', 'Counts reps, measures joint angles and gives form cues with the camera. Stops the set if pain rises.'],
              [Stethoscope, 'Medical officer view', 'Every crew member, most urgent first, and a message queue that shows the real light-time to Earth.'],
              [BellRing, 'Reminders', 'A gentle morning reminder and evening nudge, as real notifications on the iPhone app.'],
              [CloudOff, 'Works offline', 'Models, 3D anatomy and rules are bundled. A full check needs no connection at all.'],
              [Smartphone, 'Web and iPhone', 'An installable web app and a native iOS app, from the same code.'],
            ] as const).map(([Icon, t, d]) => (
              <div key={t} className="hp-mini card hp-reveal"><span className="ic"><Icon /></span><h3>{t}</h3><p>{d}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ proof */}
      <section className="hp-sec hp-dark" id="proof">
        <div className="hp-wrap hp-proof">
          <div className="hp-reveal">
            <p className="hp-kicker">Measured, not simulated</p>
            <h2>We tested the camera end to end.</h2>
            <p className="hp-lede">We fed synthetic videos of an anatomical mannequin into the browser as if they were a webcam, with a pulse, breathing and sway we chose, and checked what Crew Mirror measured.</p>
            <p className="hp-note">Estimates, not yet tested on astronauts or in a clinical study.</p>
          </div>
          <div className="hp-term hp-reveal" role="img" aria-label="Test results: 72 bpm pulse read as 72 bpm; faint pulse read as 73 bpm; no pulse gave No data; breathing 15 per minute read as 15; balance sway measured; 123 unit, 30 server and 42 browser checks pass">
            <div className="hp-term-bar"><i /><i /><i /><span>camera_tests.log</span></div>
            <pre>{[
              ['pulse 72 bpm, clean video', '72 bpm', 'ok'],
              ['pulse 72 bpm, faint + head jitter', '73 bpm', 'ok'],
              ['no pulse at all', 'No data', 'ok'],
              ['breathing 15 / min', '15 / min', 'ok'],
              ['balance sway, 1.5 cm', '2.8 % SW', 'ok'],
              ['unit · server · browser tests', '123 · 30 · 42', 'pass'],
            ].map(([a, b, c]) => (
              <span key={a} className="hp-term-row"><span className="k">{a}</span><span className="v">{b}</span><span className="ok"><Check size={13} /> {c}</span>{'\n'}</span>
            ))}</pre>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ safety */}
      <section className="hp-sec" id="safety">
        <div className="hp-wrap">
          <p className="hp-kicker hp-reveal">Safe by design</p>
          <h2 className="hp-reveal">Honest about what it knows.</h2>
          <div className="hp-grid hp-grid-4">
            {([
              [ShieldAlert, 'Danger signs first', 'Chest pain, stroke signs or pain after a fall go straight to the crew medical officer. No exercises.'],
              [Activity, '“No data”, never “Fine”', 'Poor light, movement, a skipped scan or an old reading is shown as No data, not as a reassuring guess.'],
              [Check, 'Rules, not AI, decide safety', 'Triage is fixed, testable rules, and every status shows the reason behind it.'],
              [EyeOff, 'Video never leaves the device', 'Only the numbers are saved. The camera image is never shown, stored or sent.'],
            ] as const).map(([Icon, t, d]) => (
              <div key={t} className="hp-mini card hp-reveal"><span className="ic"><Icon /></span><h3>{t}</h3><p>{d}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ final call */}
      <section className="hp-final">
        <div className="hp-wrap hp-reveal">
          <h2>Two minutes a day.<br />Measured against <em>you.</em></h2>
          <div className="hp-cta hp-cta-c">
            <a className="btn primary" href={APP}><ScanFace /> Open the app</a>
            <a className="btn hp-btn-dark" href={FILM}><Play /> Watch the film</a>
            <a className="hp-textlink" href={CODE} target="_blank" rel="noreferrer"><Code2 size={16} /> GitHub</a>
          </div>
        </div>
      </section>

      <footer className="hp-foot">
        <div className="hp-wrap">
          <div className="hp-foot-top"><a className="hp-brand" href="#/"><Logo size={22} /><span>Crew Mirror</span></a><span>Team SYS-ASTRO · NASA Space Apps Challenge 2026, Seoul</span></div>
          <p><b>Prototype, not a medical device.</b> Results are patterns, never diagnoses. Not affiliated with or endorsed by NASA.</p>
          <p className="hp-credits">Data are courtesy of the NASA Open Science Data Repository (https://osdr.nasa.gov/bio/repo) · Dataset metadata from data.nasa.gov · Space weather from NOAA SWPC · 3D anatomy: Z-Anatomy (CC BY-SA 4.0). Full credits in the <a href={CODE + '#references'} target="_blank" rel="noreferrer">README</a>.</p>
        </div>
      </footer>
    </div>
  )
}
