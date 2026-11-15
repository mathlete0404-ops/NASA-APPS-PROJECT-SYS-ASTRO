// Offline-first store. Everything lives in IndexedDB on the crew device; the habitat
// server gets copies of the derived numbers when it is reachable. Video is never stored.
import { get, set, clear } from 'idb-keyval'
import { useSyncExternalStore } from 'react'
import type { CalendarEvent, CrewProfile, DownlinkMsg, FoodEntry, Session, SymptomReport, Workout } from './types'
import { PHASES } from '../content/mission'
import { metricStatus, METRICS, type StatusResult } from '../engine/status'
import { api } from './api'
import { bootDone } from '../boot'
import * as cloud from './cloud'

export interface State {
  loaded: boolean
  crew: CrewProfile[]
  activeCrew: string
  sessions: Session[]
  symptoms: SymptomReport[]
  downlink: DownlinkMsg[]
  events: CalendarEvent[]
  workouts: Workout[]
  food: FoodEntry[]
  online: boolean
  account: { email: string; callSign: string; mission: string; isCmo: boolean } | null
  /** Finished the first-open setup (who you are). */
  onboarded: boolean
}

const KEY = 'crew-mirror:v2'
let state: State = { loaded: false, crew: [], activeCrew: '', sessions: [], symptoms: [], downlink: [], events: [], workouts: [], food: [], online: false, account: null, onboarded: false }
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

function setState(patch: Partial<State>, persist = true) {
  state = { ...state, ...patch }
  emit()
  if (persist) void save()
}

async function save() {
  const { crew, activeCrew, sessions, symptoms, downlink, events, workouts, food, onboarded } = state
  try {
    await set(KEY, { crew, activeCrew, sessions, symptoms, downlink, events, workouts, food, onboarded })
  } catch {
    /* private mode etc. — the app still works in memory */
  }
}

type Saved = Partial<State> & { sample?: boolean }

// Builds before 2026-11-15 could load a made-up crew (saved with `sample: true` and
// `synthetic` records). None of it belongs to this astronaut: drop it, keep anything
// they recorded themselves, and send them back to the first-open setup.
const OLD_SAMPLE_IDS = /^(ev-(launch|eva1|eva2|med|land)|MS2-sym-1|(CDR|PLT|MS1|MS2)-wo-\d+)$/
export function dropOldSample(saved: Saved): Partial<State> {
  const own = <T extends { id: string }>(xs: T[] | undefined) =>
    (xs ?? []).filter((x) => !(x as { synthetic?: boolean }).synthetic && !OLD_SAMPLE_IDS.test(x.id))
  return {
    crew: [], activeCrew: '', onboarded: false,
    sessions: own(saved.sessions), symptoms: own(saved.symptoms), events: own(saved.events),
    workouts: own(saved.workouts), food: own(saved.food), downlink: own(saved.downlink),
  }
}

export async function load() {
  let saved: Saved | undefined
  try {
    saved = await get(KEY)
  } catch {
    saved = undefined
  }
  if (saved?.sample) {
    const kept = dropOldSample(saved)
    setState({ ...kept, loaded: true })
  } else if (saved?.crew?.length) {
    const rest: Saved = { ...saved }
    delete rest.sample
    setState({ events: [], workouts: [], food: [], onboarded: true, ...rest, loaded: true }, false)
  }
  // First open: no data yet — the welcome setup asks who you are.
  else setState({ loaded: true }, false)
  bootDone()
  void refreshOnline()
  cloud.onCloudUser((u) => void onAccount(u))
  void cloud.initCloud().catch(() => undefined)
}

/** Signed in → make sure this astronaut has a local profile, select it, merge cloud data. */
async function onAccount(u: import('@supabase/supabase-js').User | null) {
  if (!u) { setState({ account: null }, false); return }
  try {
    const prof = await cloud.myProfile()
    if (!prof) return
    const id = prof.call_sign
    const existing = state.crew.find((c) => c.id === id)
    const launch = prof.launch_date ?? existing?.launchDate ?? new Date().toISOString().slice(0, 10)
    const me: CrewProfile = {
      ...(existing ?? { transitDays: 0 }), id, role: prof.role, launchDate: launch, phase: prof.phase as CrewProfile['phase'],
      transitDays: prof.transit_days ?? existing?.transitDays ?? 0, isCmo: prof.is_cmo,
      massKg: prof.mass_kg ?? existing?.massKg, targets: (prof.targets as CrewProfile['targets']) ?? existing?.targets,
    }
    const pulled = await cloud.pullAll(id)
    const merge = <T extends { id: string }>(a: T[], b: T[]) => [...new Map([...a, ...b].map((x) => [x.id, x])).values()]
    setState({
      account: { email: u.email ?? '', callSign: id, mission: prof.mission_code, isCmo: prof.is_cmo },
      crew: existing ? state.crew.map((c) => (c.id === id ? me : c)) : [...state.crew, me],
      activeCrew: id,
      sessions: merge(state.sessions, pulled.sessions), symptoms: merge(state.symptoms, pulled.symptoms),
      workouts: merge(state.workouts, pulled.workouts), food: merge(state.food, pulled.food), events: merge(state.events, pulled.events),
    })
    // upload anything recorded on this device before signing in
    const mine = <T extends { crewId: string }>(xs: T[]) => xs.filter((x) => x.crewId === id)
    await Promise.all([
      ...mine(state.sessions).map(cloud.pushSession), ...mine(state.symptoms).map(cloud.pushSymptom),
      ...mine(state.workouts).map(cloud.pushWorkout), ...mine(state.food).map(cloud.pushFood), ...mine(state.events).map(cloud.pushEvent),
    ])
  } catch { /* offline: try again next time */ }
}

const isMine = (crewId: string) => state.account?.callSign === crewId

export async function refreshOnline() {
  const online = await api.health()
  if (online !== state.online) setState({ online }, false)
  if (online) await api.flushOutbox()
}

export const useStore = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => state)
export const getState = () => state

// ---------------------------------------------------------------- derived
export const activeProfile = (s: State = state) => s.crew.find((c) => c.id === s.activeCrew) ?? s.crew[0]

export function missionDay(p: CrewProfile, now = new Date()): number {
  const launch = new Date(p.launchDate + 'T00:00:00')
  return Math.floor((now.getTime() - launch.getTime()) / 86_400_000)
}

export function microgravityDays(p: CrewProfile, now = new Date()): number {
  if (p.phase === 'preflight') return 0
  if (PHASES[p.phase].microgravity) return Math.max(0, missionDay(p, now))
  return p.transitDays
}

export const dayKey = (ts: string | Date) => {
  const d = typeof ts === 'string' ? new Date(ts) : ts
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * One value per calendar day (the day's last good measurement, else its last attempt),
 * so the baseline is 7 *days* and "Watch 3 days in a row" really means days — repeating
 * the check five times in one morning cannot build or break a baseline.
 */
export function history(sessions: Session[], crewId: string, metric: string): { ts: string; value: number | null; ok: boolean }[] {
  const all = sessions
    .filter((s) => s.crewId === crewId)
    .sort((a, b) => a.ts.localeCompare(b.ts))
    .flatMap((s) => s.measurements.filter((m) => m.metric === metric).map((m) => ({ ts: s.ts, value: m.value, ok: m.ok })))
  const byDay = new Map<string, { ts: string; value: number | null; ok: boolean }>()
  for (const h of all) {
    const k = dayKey(h.ts)
    const prev = byDay.get(k)
    if (!prev || h.ok || !prev.ok) byDay.set(k, h)
  }
  return [...byDay.values()]
}

/** Measured by the face scan, which a daily check can skip. */
export const FACE_METRICS = ['hr_rest', 'resp_rate', 'blink_rate', 'perclos', 'face_width']
/** Answered in every daily check. */
export const CHECKIN_METRICS = ['mood', 'energy', 'sleep_hours', 'sleep_quality']
/** A daily-check value older than this is not "today's" status any more. */
export const STALE_DAYS = 2

/**
 * Status of every metric for one crew member. A status describes NOW, so an old value is never
 * shown as current: a face measure skipped in the latest daily check, or any daily-check measure
 * older than STALE_DAYS, is "No data" (with the last good value in the reason), never "Fine".
 */
export function crewStatus(s: State, crewId: string, now: Date = new Date()): Record<string, StatusResult> {
  const out: Record<string, StatusResult> = {}
  const daily = s.sessions.filter((x) => x.crewId === crewId && x.kind === 'daily')
  const lastCheckDay = daily.reduce((m, x) => (dayKey(x.ts) > m ? dayKey(x.ts) : m), '')
  const today = dayKey(now)
  for (const id of Object.keys(METRICS)) {
    const h = history(s.sessions, crewId, id)
    if (!h.length) continue
    const st = metricStatus(id, h.map((x) => [x.value, x.ok]))
    const last = h[h.length - 1]
    const lastDay = dayKey(last.ts)
    const ageDays = Math.round((new Date(today + 'T12:00:00').getTime() - new Date(lastDay + 'T12:00:00').getTime()) / 864e5)
    const lastGood = [...h].reverse().find((x) => x.ok && x.value != null)
    const was = lastGood ? ` Last good value ${lastGood.value} ${METRICS[id].unit} on ${new Date(lastGood.ts).toLocaleDateString()}.` : ''
    const skipped = FACE_METRICS.includes(id) && lastCheckDay && lastDay < lastCheckDay
    const stale = (FACE_METRICS.includes(id) || CHECKIN_METRICS.includes(id)) && ageDays > STALE_DAYS
    if (skipped) out[id] = { ...st, level: 'nodata', why: 'skipped', value: undefined, z: undefined, reasons: [`Not measured in your latest check (${new Date(lastCheckDay + 'T12:00:00').toLocaleDateString()}): the face scan was skipped or did not finish.${was}`] }
    else if (stale) out[id] = { ...st, level: 'nodata', why: 'stale', ageDays, value: undefined, z: undefined, reasons: [`Last measured ${ageDays} days ago, so there is no current reading. Do a daily check to update it.${was}`] }
    else out[id] = st.level === 'nodata' ? { ...st, why: 'quality' } : st
  }
  return out
}

// ---------------------------------------------------------------- mutations
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

export function setActiveCrew(id: string) {
  setState({ activeCrew: id })
}

export function updateProfile(p: CrewProfile) {
  setState({ crew: state.crew.map((c) => (c.id === p.id ? p : c)) })
  void api.pushProfile(p, microgravityDays(p))
  if (isMine(p.id)) void cloud.saveProfile(p).catch(() => undefined)
}

export function addSession(s: Session) {
  setState({ sessions: [...state.sessions, s] })
  void api.pushSession(s)
  if (isMine(s.crewId)) void cloud.pushSession(s).catch(() => undefined)
}

export function addSymptom(r: SymptomReport) {
  setState({ symptoms: [...state.symptoms, r] })
  void api.pushSymptom(r)
  if (isMine(r.crewId)) void cloud.pushSymptom(r).catch(() => undefined)
}

export function addEvent(e: CalendarEvent) {
  setState({ events: [...state.events, e] })
  if (isMine(e.crewId)) void cloud.pushEvent(e).catch(() => undefined)
}

export function addWorkout(w: Workout) {
  setState({ workouts: [...state.workouts, w] })
  if (isMine(w.crewId)) void cloud.pushWorkout(w).catch(() => undefined)
}

/** Undo a manually ticked plan session. Local only: cloud.ts (teammate-owned) has no workout delete yet. */
export function removeWorkout(id: string) {
  setState({ workouts: state.workouts.filter((w) => w.id !== id) })
}

export function addFood(f: FoodEntry) {
  setState({ food: [...state.food, f] })
  if (isMine(f.crewId)) void cloud.pushFood(f).catch(() => undefined)
}

export function removeFood(id: string) {
  setState({ food: state.food.filter((f) => f.id !== id) })
  void cloud.deleteFood(id).catch(() => undefined)
}

export function removeEvent(id: string) {
  setState({ events: state.events.filter((e) => e.id !== id) })
  void cloud.deleteEvent(id).catch(() => undefined)
}

// Hand-off from the Body page ("report pain here") to the report flow. Not persisted.
export interface ReportDraft { region: import('../engine/triage').Region; side: 'left' | 'right' | 'middle'; structure?: string }
let reportDraft: ReportDraft | null = null
export const setReportDraft = (d: ReportDraft | null) => { reportDraft = d }
export const takeReportDraft = () => { const d = reportDraft; reportDraft = null; return d }

export function addDownlink(m: DownlinkMsg) {
  setState({ downlink: [m, ...state.downlink] })
  void api.pushDownlink(m)
}

/** First-open setup: create this device's own crew profile. Anything already recorded
 *  on this device under the same call sign is kept. */
export function createProfile(p: CrewProfile) {
  const keep = <T extends { crewId: string }>(xs: T[]) => xs.filter((x) => x.crewId === p.id)
  setState({
    crew: [p], activeCrew: p.id, sessions: keep(state.sessions), symptoms: keep(state.symptoms), downlink: keep(state.downlink),
    events: state.events.filter((e) => e.crewId === p.id || e.crewId === 'ALL'), workouts: keep(state.workouts), food: keep(state.food), onboarded: true,
  })
  void api.pushProfile(p, microgravityDays(p))
}

/** Erase this device → back to the welcome setup. */
export async function resetEmpty() {
  try {
    await clear()
  } catch {
    /* ignore */
  }
  setState({ crew: [], activeCrew: '', sessions: [], symptoms: [], downlink: [], events: [], workouts: [], food: [], onboarded: false })
}

/** Everything on this device as JSON (derived numbers only). */
export function exportData() {
  const { crew, sessions, symptoms, workouts, food, events, downlink } = state
  return JSON.stringify({ exported: new Date().toISOString(), app: 'Crew Mirror', note: 'Derived numbers only — no images or video.', crew, sessions, symptoms, workouts, food, events, downlink }, null, 1)
}
