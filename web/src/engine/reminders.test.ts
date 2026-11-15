import { describe, expect, it } from 'vitest'
import { checkOverdue, COPY, DEFAULT_REMINDERS, dueReminders, normalizeSettings, parseTime, planReminders, type ReminderSettings } from './reminders'

// Fixed local "now": Sun 15 Nov 2026, 10:00 local time.
const NOW = new Date(2026, 10, 15, 10, 0, 0)
const on: ReminderSettings = { enabled: true, time: '08:00', nudge: true }
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

describe('parseTime / normalizeSettings', () => {
  it('parses valid 24-hour times', () => {
    expect(parseTime('08:00')).toBe(480)
    expect(parseTime('7:05')).toBe(425)
    expect(parseTime('23:59')).toBe(1439)
  })
  it('rejects broken times', () => {
    for (const s of ['24:00', '12:60', '', 'noon', '8', '08:0']) expect(parseTime(s)).toBeNull()
  })
  it('falls back to defaults for missing or bad stored values', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_REMINDERS)
    expect(normalizeSettings({ enabled: 'yes', time: '99:99', nudge: 1 })).toEqual(DEFAULT_REMINDERS)
    expect(normalizeSettings({ enabled: true, time: '06:30', nudge: false })).toEqual({ enabled: true, time: '06:30', nudge: false })
  })
  it('defaults: off, 08:00, evening nudge on', () => {
    expect(DEFAULT_REMINDERS).toEqual({ enabled: false, time: '08:00', nudge: true })
  })
})

describe('planReminders', () => {
  it('schedules nothing when reminders are off', () => {
    expect(planReminders({ ...on, enabled: false }, NOW, false)).toEqual([])
  })

  it('covers the next 7 days, morning + evening nudge, in order', () => {
    const early = new Date(2026, 10, 15, 6, 0)
    const list = planReminders(on, early, false)
    expect(list).toHaveLength(14)
    expect(list.map((r) => r.at.getDate())).toEqual([15, 15, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21])
    expect(list.filter((r) => r.kind === 'morning').every((r) => hhmm(r.at) === '08:00')).toBe(true)
    expect(list.filter((r) => r.kind === 'nudge').every((r) => hhmm(r.at) === '20:00')).toBe(true)
    for (let i = 1; i < list.length; i++) expect(list[i].at.getTime()).toBeGreaterThan(list[i - 1].at.getTime())
  })

  it('skips reminders whose time already passed today', () => {
    const list = planReminders(on, NOW, false) // 10:00: today's 08:00 is gone, 20:00 is not
    expect(list[0]).toMatchObject({ kind: 'nudge' })
    expect(list[0].at.getDate()).toBe(15)
    expect(list).toHaveLength(13)
    expect(list.every((r) => r.at.getTime() > NOW.getTime())).toBe(true)
  })

  it('schedules nothing for today once today’s check is done', () => {
    const list = planReminders(on, new Date(2026, 10, 15, 6, 0), true)
    expect(list.some((r) => r.at.getDate() === 15)).toBe(false)
    expect(list[0].at.getDate()).toBe(16)
    expect(list).toHaveLength(12)
  })

  it('leaves out the evening nudge when it is turned off', () => {
    const list = planReminders({ ...on, nudge: false }, new Date(2026, 10, 15, 6, 0), false)
    expect(list).toHaveLength(7)
    expect(list.every((r) => r.kind === 'morning')).toBe(true)
  })

  it('does not nudge before or at the morning reminder time', () => {
    const list = planReminders({ ...on, time: '21:00' }, new Date(2026, 10, 15, 6, 0), false)
    expect(list.every((r) => r.kind === 'morning' && hhmm(r.at) === '21:00')).toBe(true)
  })

  it('uses the stated copy', () => {
    const [nudge, morning] = planReminders(on, NOW, false)
    expect(morning).toMatchObject({ title: 'Time for your daily check', body: 'It takes 2 minutes.' })
    expect(nudge).toMatchObject({ title: COPY.nudge.title, body: 'Two minutes now keeps your normal accurate.' })
    expect(nudge.title).toMatch(/^You haven.t done today.s check$/)
  })

  it('gives unique, stable 32-bit integer ids', () => {
    const a = planReminders(on, new Date(2026, 10, 15, 6, 0), false)
    const b = planReminders(on, new Date(2026, 10, 15, 7, 0), false)
    expect(new Set(a.map((r) => r.id)).size).toBe(a.length)
    expect(a.map((r) => r.id)).toEqual(b.map((r) => r.id))
    expect(a[0].id).toBe(202611151)
    expect(a[1].id).toBe(202611152)
    expect(a.every((r) => Number.isInteger(r.id) && r.id < 2 ** 31)).toBe(true)
  })

  it('crosses month and year ends', () => {
    const list = planReminders(on, new Date(2026, 11, 29, 6, 0), false)
    expect(list.map((r) => r.at.getDate()).filter((_, i) => i % 2 === 0)).toEqual([29, 30, 31, 1, 2, 3, 4])
    expect(list[list.length - 1].at.getFullYear()).toBe(2027)
  })
})

describe('checkOverdue', () => {
  it('is true after the reminder time when the check is not done', () => {
    expect(checkOverdue(on, NOW, false)).toBe(true)
  })
  it('is false before the reminder time, when done, or when off', () => {
    expect(checkOverdue(on, new Date(2026, 10, 15, 7, 59), false)).toBe(false)
    expect(checkOverdue(on, NOW, true)).toBe(false)
    expect(checkOverdue({ ...on, enabled: false }, NOW, false)).toBe(false)
  })
})

describe('dueReminders (web timer)', () => {
  it('returns the reminder whose time just passed, once', () => {
    const t = new Date(2026, 10, 15, 8, 0, 30)
    const due = dueReminders(on, t, false, new Set())
    expect(due.map((r) => r.kind)).toEqual(['morning'])
    expect(dueReminders(on, t, false, new Set([due[0].id]))).toEqual([])
  })
  it('does not show a reminder long after its time', () => {
    expect(dueReminders(on, new Date(2026, 10, 15, 10, 0), false, new Set())).toEqual([])
  })
  it('returns nothing when today’s check is done', () => {
    expect(dueReminders(on, new Date(2026, 10, 15, 20, 1), true, new Set())).toEqual([])
  })
  it('puts the latest due reminder first', () => {
    const due = dueReminders({ ...on, time: '19:30' }, new Date(2026, 10, 15, 20, 5), false, new Set())
    expect(due.map((r) => r.kind)).toEqual(['nudge', 'morning'])
  })
})
