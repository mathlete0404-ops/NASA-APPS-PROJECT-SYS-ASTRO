// Daily check reminders: which local notifications to schedule, as a pure function of the
// settings, the clock and whether today's daily check is done. No platform code here.

export interface ReminderSettings {
  enabled: boolean
  /** local time of the morning reminder, 'HH:MM' */
  time: string
  /** a second reminder in the evening if the check still isn't done */
  nudge: boolean
}

export const DEFAULT_REMINDERS: ReminderSettings = { enabled: false, time: '08:00', nudge: true }
export const NUDGE_TIME = '20:00'
export const PLAN_DAYS = 7

export type ReminderKind = 'morning' | 'nudge'

export interface Reminder {
  /** numeric so it works as an iOS/Android notification id: YYYYMMDD * 10 + kind (1 morning, 2 nudge) */
  id: number
  kind: ReminderKind
  at: Date
  title: string
  body: string
}

export const COPY: Record<ReminderKind, { title: string; body: string }> = {
  morning: { title: 'Time for your daily check', body: 'It takes 2 minutes.' },
  nudge: { title: 'You haven’t done today’s check', body: 'Two minutes now keeps your normal accurate.' },
}

/** 'HH:MM' → minutes after midnight, or null when it is not a valid 24-hour time. */
export function parseTime(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim())
  if (!m) return null
  const h = +m[1], min = +m[2]
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** Settings from untrusted storage, with defaults for anything missing or broken. */
export function normalizeSettings(raw: unknown): ReminderSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof ReminderSettings, unknown>>
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : DEFAULT_REMINDERS.enabled,
    time: typeof r.time === 'string' && parseTime(r.time) !== null ? r.time : DEFAULT_REMINDERS.time,
    nudge: typeof r.nudge === 'boolean' ? r.nudge : DEFAULT_REMINDERS.nudge,
  }
}

const atMinutes = (day: Date, minutes: number) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60, 0, 0)

const reminderId = (day: Date, kind: ReminderKind) =>
  (day.getFullYear() * 10000 + (day.getMonth() + 1) * 100 + day.getDate()) * 10 + (kind === 'morning' ? 1 : 2)

/** Both reminders for one calendar day (local time), whether or not their time has passed. */
export function remindersForDay(settings: ReminderSettings, day: Date): Reminder[] {
  if (!settings.enabled) return []
  const morning = parseTime(settings.time) ?? parseTime(DEFAULT_REMINDERS.time)!
  const nudge = parseTime(NUDGE_TIME)!
  const out: Reminder[] = [{ id: reminderId(day, 'morning'), kind: 'morning', at: atMinutes(day, morning), ...COPY.morning }]
  // The nudge only makes sense after the morning reminder.
  if (settings.nudge && nudge > morning) out.push({ id: reminderId(day, 'nudge'), kind: 'nudge', at: atMinutes(day, nudge), ...COPY.nudge })
  return out
}

/** Reminders to schedule for today and the next 6 days. Nothing for today once today's check is done. */
export function planReminders(settings: ReminderSettings, now: Date, todayDone: boolean, days = PLAN_DAYS): Reminder[] {
  if (!settings.enabled) return []
  const out: Reminder[] = []
  for (let i = 0; i < days; i++) {
    if (i === 0 && todayDone) continue
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
    for (const r of remindersForDay(settings, day)) if (r.at.getTime() > now.getTime()) out.push(r)
  }
  return out
}

/** True when reminders are on, the morning reminder time has passed today and the check isn't done. */
export function checkOverdue(settings: ReminderSettings, now: Date, todayDone: boolean): boolean {
  if (!settings.enabled || todayDone) return false
  const first = remindersForDay(settings, now)[0]
  return !!first && first.at.getTime() <= now.getTime()
}

/** How long after its time a reminder may still be shown by the in-browser timer. */
export const WEB_GRACE_MS = 60 * 60 * 1000

/**
 * For the web, where nothing can be scheduled ahead: today's reminders that are due now
 * (time passed less than `graceMs` ago) and not shown yet. Shown latest first.
 */
export function dueReminders(settings: ReminderSettings, now: Date, todayDone: boolean, shown: ReadonlySet<number>, graceMs = WEB_GRACE_MS): Reminder[] {
  if (!settings.enabled || todayDone) return []
  const t = now.getTime()
  return remindersForDay(settings, now)
    .filter((r) => r.at.getTime() <= t && t - r.at.getTime() < graceMs && !shown.has(r.id))
    .sort((a, b) => b.at.getTime() - a.at.getTime())
}
