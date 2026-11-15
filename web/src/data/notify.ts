// Daily check reminders on each platform.
//  - iOS app (Capacitor): real local notifications, scheduled 7 days ahead, so they arrive
//    even when the app is closed. Re-planned on start, on return to the foreground, after a
//    daily check is saved and when the settings change.
//  - Web: the Notification API, checked once a minute while the app is open. Each reminder
//    is shown at most once (ids kept in localStorage).
// Settings live in localStorage (not in the IndexedDB state).
import { useEffect, useSyncExternalStore } from 'react'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { activeProfile, dayKey, getState, useStore } from './store'
import { DEFAULT_REMINDERS, dueReminders, normalizeSettings, planReminders, type ReminderSettings } from '../engine/reminders'

const KEY = 'crew-mirror:reminders'
const SHOWN_KEY = 'crew-mirror:reminders:shown'
const EVENT = 'crew-mirror:reminders'
const CHECK_HASH = '#/app/check'
const NOW_ID = 1 // "Send a reminder now"

export const isNative = () => Capacitor.isNativePlatform()

// ---------------------------------------------------------------- settings
let cacheRaw: string | null | undefined
let cache: ReminderSettings = DEFAULT_REMINDERS

export function loadReminderSettings(): ReminderSettings {
  let raw: string | null = null
  try { raw = localStorage.getItem(KEY) } catch { /* storage blocked */ }
  if (raw !== cacheRaw) {
    cacheRaw = raw
    try { cache = normalizeSettings(raw ? JSON.parse(raw) : null) } catch { cache = DEFAULT_REMINDERS }
  }
  return cache
}

export function saveReminderSettings(s: ReminderSettings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* storage blocked */ }
  window.dispatchEvent(new Event(EVENT))
}

export function useReminderSettings(): ReminderSettings {
  return useSyncExternalStore((f) => {
    window.addEventListener(EVENT, f)
    window.addEventListener('storage', f)
    return () => { window.removeEventListener(EVENT, f); window.removeEventListener('storage', f) }
  }, loadReminderSettings)
}

// ---------------------------------------------------------------- permission
export type NotifyPermission = 'granted' | 'denied' | 'prompt' | 'unsupported'

const webSupported = () => typeof window !== 'undefined' && 'Notification' in window
const fromWeb = (p: NotificationPermission): NotifyPermission => (p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'prompt')
const fromNative = (p: string): NotifyPermission => (p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'prompt')

export async function checkPermission(): Promise<NotifyPermission> {
  try {
    if (isNative()) return fromNative((await LocalNotifications.checkPermissions()).display)
    return webSupported() ? fromWeb(Notification.permission) : 'unsupported'
  } catch { return 'unsupported' }
}

/** Ask the system. Only called from a user action (turning reminders on, or sending one now).
 *  Once allowed, the reminders are planned straight away. */
export async function requestPermission(): Promise<NotifyPermission> {
  const p = await askPermission()
  if (p === 'granted') void syncReminders()
  return p
}

async function askPermission(): Promise<NotifyPermission> {
  try {
    if (isNative()) return fromNative((await LocalNotifications.requestPermissions()).display)
    if (!webSupported()) return 'unsupported'
    if (Notification.permission !== 'default') return fromWeb(Notification.permission)
    return fromWeb(await Notification.requestPermission())
  } catch { return 'unsupported' }
}

// ---------------------------------------------------------------- showing / scheduling
function todayDoneNow(): boolean {
  const s = getState()
  const p = activeProfile(s)
  if (!p) return false
  const today = dayKey(new Date())
  return s.sessions.some((x) => x.crewId === p.id && x.kind === 'daily' && dayKey(x.ts) === today)
}

async function showWeb(title: string, body: string, tag: string) {
  if (!webSupported() || Notification.permission !== 'granted') return false
  const opts: NotificationOptions = { body, tag, icon: 'favicon.svg', data: { url: CHECK_HASH } }
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
    if (reg) {
      await (await navigator.serviceWorker.ready).showNotification(title, opts)
      return true
    }
  } catch { /* fall back below */ }
  try {
    const n = new Notification(title, opts)
    n.onclick = () => { window.focus(); location.hash = CHECK_HASH; n.close() }
    return true
  } catch { return false }
}

const loadShown = (): number[] => {
  try { const j = JSON.parse(localStorage.getItem(SHOWN_KEY) ?? '[]'); return Array.isArray(j) ? j.filter((x) => typeof x === 'number') : [] } catch { return [] }
}
const saveShown = (ids: number[]) => { try { localStorage.setItem(SHOWN_KEY, JSON.stringify(ids.slice(-40))) } catch { /* ignore */ } }

/** Web: show the reminder that is due now, once per id. */
async function webTick() {
  const settings = loadReminderSettings()
  if (!settings.enabled || !webSupported() || Notification.permission !== 'granted') return
  const shown = loadShown()
  const due = dueReminders(settings, new Date(), todayDoneNow(), new Set(shown))
  if (!due.length) return
  // Record first, so two open tabs or a slow showNotification don't double up.
  saveShown([...shown, ...due.map((r) => r.id)])
  await showWeb(due[0].title, due[0].body, `crew-mirror-${due[0].id}`)
}

let chain: Promise<unknown> = Promise.resolve()
let lastNativeDay = ''

/** iOS: cancel what is pending and schedule the next 7 days. Web: check what is due now. */
export function syncReminders(): Promise<unknown> {
  chain = chain.then(async () => {
    if (!isNative()) return webTick()
    const settings = loadReminderSettings()
    lastNativeDay = dayKey(new Date())
    const pending = (await LocalNotifications.getPending()).notifications.filter((n) => n.id !== NOW_ID)
    if (pending.length) await LocalNotifications.cancel({ notifications: pending.map((n) => ({ id: n.id })) })
    if (!settings.enabled) return
    // Never prompt from a background re-plan: schedule() would ask on its own.
    if ((await LocalNotifications.checkPermissions()).display !== 'granted') return
    const list = planReminders(settings, new Date(), todayDoneNow())
    if (!list.length) return
    await LocalNotifications.schedule({
      notifications: list.map((r) => ({ id: r.id, title: r.title, body: r.body, schedule: { at: r.at, allowWhileIdle: true }, extra: { url: CHECK_HASH } })),
    })
  }).catch((e) => console.warn('reminders:', e))
  return chain
}

/** "Send a reminder now". Returns false when the system won't show it. */
export async function sendReminderNow(): Promise<boolean> {
  const perm = await requestPermission()
  if (perm !== 'granted') return false
  const title = 'Time for your daily check', body = 'It takes 2 minutes.'
  if (isNative()) {
    try {
      await LocalNotifications.schedule({ notifications: [{ id: NOW_ID, title, body, schedule: { at: new Date(Date.now() + 1500) }, extra: { url: CHECK_HASH } }] })
      return true
    } catch { return false }
  }
  return showWeb(title, body, 'crew-mirror-now')
}

// ---------------------------------------------------------------- app wiring
let tapListener = false

/** Mounted once in the app shell: keeps reminders in step with settings and the daily check. */
export function useReminderSync() {
  const s = useStore()
  const p = activeProfile(s)
  const settings = useReminderSettings()
  const today = dayKey(new Date())
  const done = !!p && s.sessions.some((x) => x.crewId === p.id && x.kind === 'daily' && dayKey(x.ts) === today)

  // App start, settings change, daily check saved, active crew member changed.
  useEffect(() => { if (s.loaded) void syncReminders() }, [s.loaded, settings, done, p?.id])

  useEffect(() => {
    if (isNative() && !tapListener) {
      tapListener = true
      void LocalNotifications.addListener('localNotificationActionPerformed', () => { location.hash = CHECK_HASH })
    }
    const onVisible = () => { if (document.visibilityState === 'visible') void syncReminders() }
    document.addEventListener('visibilitychange', onVisible)
    // Web: the once-a-minute check. iOS: catches the day rolling over while the app stays open.
    const id = window.setInterval(() => { if (!isNative() || lastNativeDay !== dayKey(new Date())) void syncReminders() }, 60_000)
    return () => { document.removeEventListener('visibilitychange', onVisible); window.clearInterval(id) }
  }, [])
}
