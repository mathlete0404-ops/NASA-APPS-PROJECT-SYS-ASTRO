// Turns the crew member's current data into 3D highlights: "is there a problem, and where?"
import type { State } from '../data/store'
import { crewStatus } from '../data/store'
import { METRICS, type Level } from '../engine/status'
import type { Region } from '../engine/triage'
import type { Highlight, Tone } from './BodyViewer'
import { PATTERN_LABEL } from '../engine/triage'
import { plain } from '../engine/describe'

export interface Problem { id: string; tone: Tone; level: Level | 'act_now' | 'cmo' | 'self_care'; title: string; detail: string; region: Region; side?: 'left' | 'right' | 'middle' | 'both'; highlight: Highlight[] }

const RECENT_DAYS = 14

// Which body part a measurement "lives" in, for the overlay.
const METRIC_SITE: Record<string, { region: Region; match?: RegExp; why: string }> = {
  face_width: { region: 'head', why: 'Fuller face: fluid moving to the head' },
  blink_rate: { region: 'head', why: 'Fatigue signs around the eyes' },
  perclos: { region: 'head', why: 'Fatigue signs around the eyes' },
  sleep_hours: { region: 'head', why: 'Sleep below your usual' },
  sleep_quality: { region: 'head', why: 'Sleep quality below your usual' },
  energy: { region: 'head', why: 'Energy below your usual' },
  mood: { region: 'head', why: 'Mood below your usual' },
  hr_rest: { region: 'trunk_front', match: /pectoral|stern|rib/i, why: 'Resting heart rate (estimate) away from your usual' },
  sway_eo: { region: 'ankle_foot', why: 'Balance (sway) above your usual' },
  sway_ec: { region: 'ankle_foot', why: 'Balance with eyes closed above your usual' },
  sway_tandem: { region: 'ankle_foot', why: 'Tandem-stance balance above your usual' },
  sts_time: { region: 'thigh', match: /vastus|rectus femoris|glute/i, why: 'Leg strength (sit-to-stand) below your usual' },
  body_mass: { region: 'thigh', match: /vastus|rectus femoris|soleus|gastrocnemius|biceps femoris/i, why: 'Body mass below your usual. Check food intake and muscle' },
}

export function problemsFor(s: State, crewId: string): Problem[] {
  const out: Problem[] = []
  const since = Date.now() - RECENT_DAYS * 86_400_000
  for (const r of s.symptoms.filter((x) => x.crewId === crewId && Date.parse(x.ts) >= since).sort((a, b) => b.ts.localeCompare(a.ts))) {
    if (r.region === 'other') continue
    const tone: Tone = r.result.level === 'self_care' ? 'watch' : 'act'
    out.push({
      id: r.id, tone, level: r.result.level, region: r.region, side: r.side,
      title: `${r.kind[0].toUpperCase()}${r.kind.slice(1)} ${r.intensity}/10`,
      detail: `${PATTERN_LABEL[r.result.pattern]} · ${new Date(r.ts).toLocaleDateString()}${r.structure ? ` · ${r.structure}` : ''}`,
      highlight: [{ tone, region: r.region, side: r.side, layers: ['muscles', 'skeleton', 'skin', 'joints'] },
        ...(r.structureMatch ? [{ tone: 'pain' as Tone, match: new RegExp(`^${escape(r.structureMatch)}$`, 'i'), side: r.side }] : [])],
    })
  }
  const st = crewStatus(s, crewId)
  for (const [id, res] of Object.entries(st)) {
    if (res.level !== 'act' && res.level !== 'watch') continue
    const site = METRIC_SITE[id]
    if (!site) continue
    const tone: Tone = res.level === 'act' ? 'act' : 'watch'
    out.push({
      id: `m-${id}`, tone, level: res.level, region: site.region, side: 'both',
      title: METRICS[id].label, detail: plain(id, res),
      highlight: [site.match ? { tone, region: site.region, match: site.match } : { tone, region: site.region, layers: ['skin', 'muscles'] }],
    })
  }
  return out
}

const escape = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
