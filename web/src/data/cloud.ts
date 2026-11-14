// Optional cloud account (Supabase): sign in, back up and sync the derived numbers, and let
// the crew medical officer of the same mission see the crew. The app stays fully usable
// offline and without an account — the spacecraft case. Video is never uploaded.
//
// Configure in web/.env.local (publishable key only — never a service key):
//   VITE_SUPABASE_URL=https://<project>.supabase.co
//   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
import type { Session as AuthSession, SupabaseClient, User } from '@supabase/supabase-js'
import type { CalendarEvent, CrewProfile, FoodEntry, Session, SymptomReport, Workout } from './types'

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined
export const cloudConfigured = Boolean(URL_ && KEY)

let client: SupabaseClient | null = null
async function sb(): Promise<SupabaseClient> {
  if (!cloudConfigured) throw new Error('Cloud accounts are not configured on this build.')
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js')
    client = createClient(URL_!, KEY!, { auth: { persistSession: true, autoRefreshToken: true } })
  }
  return client
}

export interface CloudProfile {
  id: string; call_sign: string; role: string; mission_code: string; is_cmo: boolean; cmo_requested?: boolean
  launch_date: string | null; phase: string; transit_days: number; mass_kg: number | null; targets: Record<string, number> | null
}

type Listener = (u: User | null) => void
const listeners = new Set<Listener>()
let currentUser: User | null = null
export const cloudUser = () => currentUser
export function onCloudUser(f: Listener) { listeners.add(f); return () => listeners.delete(f) }

export async function initCloud() {
  if (!cloudConfigured) return
  const c = await sb()
  const { data } = await c.auth.getSession()
  currentUser = data.session?.user ?? null
  listeners.forEach((f) => f(currentUser))
  c.auth.onAuthStateChange((_e, session: AuthSession | null) => {
    currentUser = session?.user ?? null
    listeners.forEach((f) => f(currentUser))
  })
}

export async function signUp(email: string, password: string, meta: { call_sign: string; role: string; mission_code: string; cmo_requested: boolean }) {
  const c = await sb()
  // confirmation link comes back to this app (wherever it is hosted), signed in
  const { data, error } = await c.auth.signUp({ email, password, options: { data: meta, emailRedirectTo: location.origin + location.pathname + '#/app/today' } })
  if (error) throw error
  return { needsConfirm: !data.session }
}
export async function signIn(email: string, password: string) {
  const c = await sb()
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw error
}
export async function signOut() { if (cloudConfigured) await (await sb()).auth.signOut() }
export async function resetPassword(email: string) {
  const { error } = await (await sb()).auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname })
  if (error) throw error
}

export async function myProfile(): Promise<CloudProfile | null> {
  if (!currentUser) return null
  const { data, error } = await (await sb()).from('profiles').select('*').eq('id', currentUser.id).maybeSingle()
  if (error) throw error
  return data as CloudProfile | null
}

export async function saveProfile(p: CrewProfile) {
  if (!currentUser) return
  await (await sb()).from('profiles').update({
    role: p.role, launch_date: p.launchDate, phase: p.phase, transit_days: p.transitDays, mass_kg: p.massKg ?? null, targets: p.targets ?? null,
  }).eq('id', currentUser.id)
}

// ---------------------------------------------------------------- sync (numbers only)
const uidOrNull = () => currentUser?.id ?? null

export async function pushSession(s: Session) {
  const user_id = uidOrNull(); if (!user_id) return
  await (await sb()).from('sessions').upsert({ id: s.id, user_id, ts: s.ts, mission_day: s.missionDay, kind: s.kind, measurements: s.measurements })
}
export async function pushSymptom(r: SymptomReport) {
  const user_id = uidOrNull(); if (!user_id) return
  await (await sb()).from('symptoms').upsert({
    id: r.id, user_id, ts: r.ts, region: r.region, side: r.side, kind: r.kind, intensity: r.intensity,
    triage_level: r.result.level, pattern: r.result.pattern, payload: r,
  })
}
export async function pushWorkout(w: Workout) {
  const user_id = uidOrNull(); if (!user_id) return
  await (await sb()).from('workouts').upsert({ id: w.id, user_id, ts: w.ts, exercise: w.exercise, payload: w })
}
export async function pushFood(f: FoodEntry) {
  const user_id = uidOrNull(); if (!user_id) return
  await (await sb()).from('food_log').upsert({ id: f.id, user_id, ts: f.ts, item_id: f.itemId, servings: f.servings })
}
export async function deleteFood(id: string) { if (uidOrNull()) await (await sb()).from('food_log').delete().eq('id', id) }
export async function pushEvent(e: CalendarEvent) {
  const user_id = uidOrNull(); if (!user_id) return
  await (await sb()).from('calendar_events').upsert({ id: e.id, user_id, date: e.date, kind: e.kind, title: e.title })
}
export async function deleteEvent(id: string) { if (uidOrNull()) await (await sb()).from('calendar_events').delete().eq('id', id) }

/** Everything this user has in the cloud, mapped to local shapes under their call sign. */
export async function pullAll(callSign: string) {
  const c = await sb()
  const [s, y, w, f, e] = await Promise.all([
    c.from('sessions').select('*').eq('user_id', currentUser!.id),
    c.from('symptoms').select('payload').eq('user_id', currentUser!.id),
    c.from('workouts').select('payload').eq('user_id', currentUser!.id),
    c.from('food_log').select('*').eq('user_id', currentUser!.id),
    c.from('calendar_events').select('*').eq('user_id', currentUser!.id),
  ])
  return {
    sessions: (s.data ?? []).map((r) => ({ id: r.id, crewId: callSign, ts: r.ts, missionDay: r.mission_day, kind: r.kind, measurements: r.measurements })) as Session[],
    symptoms: (y.data ?? []).map((r) => ({ ...(r.payload as SymptomReport), crewId: callSign })),
    workouts: (w.data ?? []).map((r) => ({ ...(r.payload as Workout), crewId: callSign })),
    food: (f.data ?? []).map((r) => ({ id: r.id, crewId: callSign, ts: r.ts, itemId: r.item_id, servings: Number(r.servings) })) as FoodEntry[],
    events: (e.data ?? []).map((r) => ({ id: r.id, crewId: callSign, date: r.date, kind: r.kind, title: r.title })) as CalendarEvent[],
  }
}

/** Crew medical officer: profiles + latest numbers of everyone on the same mission (RLS-enforced). */
export async function missionCrew() {
  const c = await sb()
  const { data: profiles } = await c.from('profiles').select('id, call_sign, role, is_cmo')
  const { data: sessions } = await c.from('sessions').select('user_id, ts, kind, measurements').order('ts', { ascending: true })
  const { data: symptoms } = await c.from('symptoms').select('user_id, payload').order('ts', { ascending: false })
  return { profiles: profiles ?? [], sessions: sessions ?? [], symptoms: symptoms ?? [] }
}
