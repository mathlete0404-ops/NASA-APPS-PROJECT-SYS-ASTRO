// Link to the habitat server (FastAPI). Sends derived numbers only. When the server is
// unreachable, writes go to an outbox and are retried — the app never depends on it.
import { get, set } from 'idb-keyval'
import type { CrewProfile, DownlinkMsg, Session, SymptomReport } from './types'
import type { State } from './store'

const BASE = (import.meta.env.VITE_HABITAT_URL as string | undefined) ?? '/api'

type Job = { method: 'POST' | 'PUT'; path: string; body: unknown }

async function call(method: string, path: string, body?: unknown, timeoutMs = 2500) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const r = await fetch(BASE + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
    })
    if (!r.ok) throw new Error(`${r.status}`)
    const ct = r.headers.get('content-type') ?? ''
    if (!ct.includes('json')) throw new Error('not the habitat server')
    return await r.json()
  } finally {
    clearTimeout(t)
  }
}

async function outbox(): Promise<Job[]> {
  try {
    return ((await get('crew-mirror:outbox')) as Job[]) ?? []
  } catch {
    return []
  }
}

async function send(job: Job) {
  try {
    await call(job.method, job.path, job.body)
  } catch {
    const q = await outbox()
    q.push(job)
    try {
      await set('crew-mirror:outbox', q.slice(-2000))
    } catch {
      /* ignore */
    }
  }
}

const sessionBody = (s: Session) => ({
  session_id: s.id, crew_id: s.crewId, ts: s.ts, mission_day: s.missionDay,
  measurements: s.measurements.map((m) => ({
    metric: m.metric, value: m.value, unit: m.unit, quality: m.quality, quality_ok: m.ok, source: m.source,
  })),
})
const symptomBody = (r: SymptomReport) => ({
  id: r.id, crew_id: r.crewId, ts: r.ts, region: r.region, kind: r.kind, intensity: r.intensity, onset: r.onset,
  side: r.side, context: r.context, danger: r.danger, tests: r.tests, microgravity_days: r.microgravityDays,
})
const profileBody = (p: CrewProfile, mg: number) => ({
  crew_id: p.id, role: p.role, launch_date: p.launchDate, phase: p.phase, gravity: 0, microgravity_days: mg,
})

export const api = {
  base: BASE,
  async health(): Promise<boolean> {
    try {
      return Boolean((await call('GET', '/health', undefined, 1500)).ok)
    } catch {
      return false
    }
  },
  async flushOutbox() {
    const q = await outbox()
    if (!q.length) return
    const left: Job[] = []
    for (const j of q) {
      try {
        await call(j.method, j.path, j.body)
      } catch {
        left.push(j)
      }
    }
    try {
      await set('crew-mirror:outbox', left)
    } catch {
      /* ignore */
    }
  },
  pushProfile: (p: CrewProfile, mg: number) => send({ method: 'PUT', path: `/crew/${p.id}`, body: profileBody(p, mg) }),
  pushSession: (s: Session) => send({ method: 'POST', path: '/sessions', body: sessionBody(s) }),
  pushSymptom: (r: SymptomReport) => send({ method: 'POST', path: '/symptoms', body: symptomBody(r) }),
  pushDownlink: (m: DownlinkMsg) => send({ method: 'POST', path: '/downlink', body: { crew_id: m.crewId, body: m.body, delay_s: m.delayS } }),
  async pushAll(s: State, microgravityDays: (p: CrewProfile) => number) {
    if (!(await this.health())) return
    await Promise.all(s.crew.map((p) => call('PUT', `/crew/${p.id}`, profileBody(p, microgravityDays(p))).catch(() => null)))
    for (const x of s.sessions) await call('POST', '/sessions', sessionBody(x)).catch(() => null)
    for (const x of s.symptoms) await call('POST', '/symptoms', symptomBody(x)).catch(() => null)
  },
  crewOverview: () => call('GET', '/crew'),
  resetDemo: () => call('POST', '/demo/reset').catch(() => null),
  search: (q: string) => call('GET', `/nasa/search?q=${encodeURIComponent(q)}`, undefined, 6000),
}
