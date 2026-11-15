// Ad capture only. Never imported by the app and never shipped.
//
// Builds a 21-day history for one astronaut (call sign MS3) in the exact save shape of
// web/src/data/store.ts (`crew-mirror:v2` in idb-keyval's default `keyval-store` / `keyval`),
// and writes it into IndexedDB of the capture browser before the app loads.
// Usage (Playwright): page.goto(<app origin>/manifest.webmanifest); page.evaluate(FIXTURE_SRC, opts); page.goto(<app>)
//
// opts.checkDays   number of daily checks, ending yesterday (default 21)
// opts.today       also add a check for today (default false)
// opts.reminders   reminder settings saved in localStorage (or null to leave the default)
// opts.foodToday   food item ids already logged today
// opts.workoutToday add today's coached squat session (ticks "Resistive session on ARED")
// opts.seen        mark Plan/Body as opened (hides the "Getting started" list)
async (opts = {}) => {
  const o = { checkDays: 21, today: false, reminders: { enabled: true, time: '07:30', nudge: true }, foodToday: [], workoutToday: false, seen: true, ...opts }
  const ID = 'MS3'
  let seed = 7
  const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const n = (sd) => (rnd() + rnd() + rnd() - 1.5) * sd * 1.15
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const now = new Date()
  const FLIGHT_DAY = 96
  const launch = new Date(now); launch.setDate(now.getDate() - FLIGHT_DAY)
  const at = (daysAgo, h, m = 0) => { const d = new Date(now); d.setDate(now.getDate() - daysAgo); d.setHours(h, m, 0, 0); return d }
  const METRIC = {
    hr_rest: ['bpm', 'Face scan · rPPG'], resp_rate: ['/min', 'Face scan · motion/colour'], blink_rate: ['/min', 'Face scan · blendshapes'],
    perclos: ['%', 'Face scan · blendshapes'], face_width: ['× eye distance', 'Face scan · landmarks'], mood: ['/10', 'Check-in'],
    energy: ['/10', 'Check-in'], sleep_hours: ['h', 'Check-in'], sleep_quality: ['/10', 'Check-in'], body_mass: ['kg', 'Scale / SLAMMD'],
  }
  const m = (metric, value, quality = 0.8) => ({ metric, value: Math.round(value * 1000) / 1000, unit: METRIC[metric][0], quality, ok: true, source: METRIC[metric][1] })
  const sessions = []
  const days = []
  for (let k = o.checkDays; k >= 1; k--) days.push(k)
  if (o.today) days.push(0)
  days.forEach((ago, i) => {
    const last = ago === 1
    const sleep = last ? 5.75 : ago === 2 ? 6.5 : 7 + n(0.25)
    const d = at(ago, 7, 35 + Math.floor(rnd() * 20))
    sessions.push({
      id: `ms3-d${String(i).padStart(2, '0')}-${iso(d)}`, crewId: ID, ts: d.toISOString(), missionDay: FLIGHT_DAY - ago, kind: 'daily',
      measurements: [
        m('hr_rest', 58 + n(1.1), 0.62), m('resp_rate', Math.round(13 + n(0.6)), 0.55), m('blink_rate', 16 + n(1.3)), m('perclos', (last ? 5 : 4) + n(0.5)),
        m('face_width', 2.31 + n(0.005)), m('mood', Math.round(7 + n(0.4)), 1), m('energy', last ? 6 : Math.round(7 + n(0.4)), 1),
        m('sleep_hours', Math.round(sleep * 4) / 4, 1), m('sleep_quality', last ? 5 : Math.round(7 + n(0.4)), 1),
      ],
    })
  })
  if (o.checkDays >= 7) {
    for (let ago = 21; ago >= 1; ago -= 3) {
      const d = at(ago, 7, 20)
      sessions.push({ id: `ms3-mass-${iso(d)}`, crewId: ID, ts: d.toISOString(), missionDay: FLIGHT_DAY - ago, kind: 'mass', measurements: [m('body_mass', 74.2 - (21 - ago) * 0.01 + n(0.12), 1)] })
    }
  }
  const workouts = []
  if (o.checkDays >= 7) {
    for (const ago of [6, 4, 3, 1]) {
      const d = at(ago, 17, 10)
      workouts.push({ id: `ms3-wo-squat-${iso(d)}`, crewId: ID, ts: d.toISOString(), exercise: 'squat', reps: 10, formScore: 90, faults: {}, bestAngle: 98, source: 'coach' })
    }
  }
  if (o.workoutToday) {
    const d = at(0, 9, 5)
    workouts.push({ id: `ms3-wo-squat-${iso(d)}`, crewId: ID, ts: d.toISOString(), exercise: 'squat', reps: 10, formScore: 100, faults: {}, bestAngle: 97, source: 'coach' })
  }
  const food = (o.foodToday || []).map((itemId, i) => ({ id: `ms3-food-${i}-${itemId}`, crewId: ID, ts: at(0, 7, 50 + i).toISOString(), itemId, servings: 1 }))
  const day = (k) => { const d = new Date(now); d.setDate(now.getDate() + k); return iso(d) }
  const events = [
    { id: 'ms3-cal-ared', crewId: ID, date: day(0), kind: 'exercise', title: 'ARED session 17:00' },
    { id: 'ms3-cal-med', crewId: ID, date: day(1), kind: 'medical', title: 'Private medical conference' },
    { id: 'ms3-cal-eva', crewId: ID, date: day(3), kind: 'eva', title: 'EVA: antenna swap (6 h 30 min)' },
    { id: 'ms3-cal-note', crewId: ID, date: day(-2), kind: 'note', title: 'Late comms pass, short sleep' },
    { id: 'ms3-cal-ex2', crewId: ID, date: day(5), kind: 'exercise', title: 'Treadmill intervals' },
    { id: 'ms3-cal-moi', crewId: 'ALL', date: day(9), kind: 'other', title: 'Course correction burn' },
  ]
  const saved = {
    crew: [{ id: ID, role: 'Mission specialist', launchDate: iso(launch), phase: 'transit', transitDays: 0, massKg: 74, scanSeconds: 60 }],
    activeCrew: ID, sessions, symptoms: [], downlink: [], events, workouts, food, onboarded: true,
  }
  localStorage.clear()
  localStorage.setItem('crew-mirror:theme', 'dark')
  if (o.reminders) localStorage.setItem('crew-mirror:reminders', JSON.stringify(o.reminders))
  if (o.seen) for (const t of ['today', 'plan', 'body', 'check', 'trends']) localStorage.setItem(`crew-mirror:seen:${t}`, '1')
  localStorage.setItem('crew-mirror:gs-hidden', '1')
  await new Promise((res, rej) => {
    const del = indexedDB.deleteDatabase('keyval-store')
    del.onsuccess = del.onerror = del.onblocked = () => {
      const req = indexedDB.open('keyval-store')
      req.onupgradeneeded = () => req.result.createObjectStore('keyval')
      req.onerror = () => rej(req.error)
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('keyval', 'readwrite')
        tx.objectStore('keyval').put(saved, 'crew-mirror:v2')
        tx.oncomplete = () => { db.close(); res() }
        tx.onerror = () => rej(tx.error)
      }
    }
  })
  return { sessions: sessions.length, workouts: workouts.length, events: events.length }
}
