import type { Phase } from '../content/mission'
import type { Kind, Region, TestAnswers, DangerAnswers, TriageResult } from '../engine/triage'

export interface CrewProfile {
  id: string // call sign, never a real name
  role: string
  launchDate: string // YYYY-MM-DD
  phase: Phase
  transitDays: number // days spent weightless; used by the bone-loss estimate after the flight
  isCmo?: boolean
  /** Used when no scale/SLAMMD reading exists yet. */
  massKg?: number
  heightCm?: number
  /** Nutrition target overrides (set by the crew nutritionist). */
  targets?: Partial<import('../content/nutrition').Targets>
  scanSeconds?: 30 | 60
}

export interface Measurement {
  metric: string
  value: number | null
  unit: string
  quality: number // 0..1
  ok: boolean // passed the quality gate
  source: string
  note?: string
}

export interface Session {
  id: string
  crewId: string
  ts: string // ISO
  missionDay: number
  kind: 'daily' | 'balance' | 'mass'
  measurements: Measurement[]
}

export interface SymptomReport {
  id: string
  crewId: string
  ts: string
  region: Region
  side: 'left' | 'right' | 'both' | 'middle'
  kind: Kind
  intensity: number
  onset: 'sudden' | 'gradual'
  context: string[]
  danger: DangerAnswers
  tests: TestAnswers
  microgravityDays: number
  result: TriageResult
  /** Exact structure picked on the 3D body (Z-Anatomy label), e.g. "Soleus muscle". */
  structure?: string
  structureMatch?: string
  /** How the location was given: tapped on 3D body, pointed at on camera, or 2D map. */
  pointedBy?: '3d' | 'camera' | 'map'
  /** Likely source from the pain-source finder (pattern, not diagnosis). */
  source?: { id: string; label: string; kind: string; score: number; reasons: string[] }
}

export interface CalendarEvent {
  id: string
  crewId: string
  date: string // YYYY-MM-DD
  kind: 'note' | 'eva' | 'exercise' | 'landing' | 'medical' | 'other'
  title: string
}

export interface DownlinkMsg {
  id: string
  crewId: string
  body: string
  sentAt: number
  deliverAt: number
  delayS: number
  route: string
}

export interface Workout {
  id: string
  crewId: string
  ts: string
  exercise: string
  reps: number
  formScore: number // % reps with no form fault
  faults: Record<string, number>
  bestAngle?: number // squat depth (min knee °) or shoulder range (max °)
  romL?: number
  romR?: number
  painBefore?: number
  painAfter?: number
  source: 'coach' | 'manual'
}

export interface FoodEntry { id: string; crewId: string; ts: string; itemId: string; servings: number }
