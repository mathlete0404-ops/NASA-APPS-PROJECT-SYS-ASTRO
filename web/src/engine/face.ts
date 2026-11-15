// Face-scan metrics from per-frame landmark results. Each metric is quality-gated.
import type { FaceFrame } from '../vision/camera'
import { estimateHeartRate, type RgbSample } from './rppg'
import { median } from './status'
import { estimateBreathing } from './resp'

export interface FaceSample { t: number; f: FaceFrame | null }
export interface FaceMetric { value: number | null; ok: boolean; quality: number; note: string }
export interface FaceScanResult {
  durationS: number
  presence: number
  hr: FaceMetric
  resp: FaceMetric
  blinkRate: FaceMetric
  perclos: FaceMetric
  faceWidth: FaceMetric
}

export const PRESENCE_MIN = 0.85
const BLINK_ON = 0.5
const BLINK_OFF = 0.3
const CLOSED = 0.7
const LUMA_MIN = 50
const LUMA_MAX = 230
const MOTION_MAX = 0.02 // nose movement (fraction of frame) between frames, median

export function analyseFaceScan(samples: FaceSample[]): FaceScanResult {
  const durationS = samples.length > 1 ? (samples[samples.length - 1].t - samples[0].t) / 1000 : 0
  const seen = samples.filter((s) => s.f) as { t: number; f: FaceFrame }[]
  const presence = samples.length ? seen.length / samples.length : 0
  const fail = (note: string): FaceMetric => ({ value: null, ok: false, quality: 0, note })
  if (durationS < 10 || presence < PRESENCE_MIN) {
    const why = durationS < 10 ? 'Scan too short.' : `Face visible only ${Math.round(presence * 100)}% of the time (need ${PRESENCE_MIN * 100}%).`
    return { durationS, presence, hr: fail(why), resp: fail(why), blinkRate: fail(why), perclos: fail(why), faceWidth: fail(why) }
  }

  // Light check
  const lumas = seen.filter((s) => s.f.rgb).map((s) => 0.299 * s.f.rgb![0] + 0.587 * s.f.rgb![1] + 0.114 * s.f.rgb![2])
  const luma = lumas.length ? median(lumas) : 0
  const lightOk = luma >= LUMA_MIN && luma <= LUMA_MAX

  // Motion check
  const moves: number[] = []
  for (let i = 1; i < seen.length; i++)
    moves.push(Math.hypot(seen[i].f.nose[0] - seen[i - 1].f.nose[0], seen[i].f.nose[1] - seen[i - 1].f.nose[1]))
  const motion = moves.length ? median(moves) : 1
  const still = motion <= MOTION_MAX

  // Heart rate (rPPG)
  let hr: FaceMetric
  if (!lightOk) hr = fail(`Light level ${Math.round(luma)} outside ${LUMA_MIN}–${LUMA_MAX}.`)
  else if (!still) hr = fail('Too much head movement.')
  else {
    const rgb: RgbSample[] = seen.filter((s) => s.f.rgb).map((s) => ({ t: s.t, r: s.f.rgb![0], g: s.f.rgb![1], b: s.f.rgb![2] }))
    const est = estimateHeartRate(rgb)
    hr = { value: est.ok ? est.bpm! : null, ok: est.ok, quality: est.quality, note: est.reason + ' Estimate, not a medical reading.' }
  }

  // Breathing rate (estimate)
  const rs = estimateBreathing(samples.map((x) => ({ t: x.t, y: x.f ? (x.f.hy ?? x.f.nose[1]) : null, g: x.f?.rgb ? x.f.rgb[1] : null })))
  const resp: FaceMetric = rs.ok ? { value: rs.bpm!, ok: true, quality: rs.quality, note: rs.reason + ' Estimate.' } : { value: null, ok: false, quality: rs.quality, note: rs.reason }

  // Blinks (hysteresis) and PERCLOS
  let blinks = 0
  let closed = false
  let closedFrames = 0
  for (const s of seen) {
    if (!closed && s.f.blink > BLINK_ON) {
      closed = true
      blinks++
    } else if (closed && s.f.blink < BLINK_OFF) closed = false
    if (s.f.blink > CLOSED) closedFrames++
  }
  const blinkRate: FaceMetric = { value: Math.round((blinks / durationS) * 60 * 10) / 10, ok: true, quality: presence, note: `${blinks} blinks in ${Math.round(durationS)} s.` }
  const perclos: FaceMetric = { value: Math.round((closedFrames / seen.length) * 1000) / 10, ok: true, quality: presence, note: 'Share of frames with eyes ≥ 70% closed.' }

  // Face width / interpupillary distance (scale-free; IPD is bony and stable)
  // only frames facing the camera (|yaw| < 6% of face width) — a turned head changes the ratio
  const YAW_MAX = 0.06
  const facing = seen.filter((s) => s.f.yaw == null || Math.abs(s.f.yaw) < YAW_MAX)
  const ratios = facing.map((s) => s.f.widthRatio).filter((x): x is number => x != null)
  const frac = median(seen.map((s) => s.f.faceFrac))
  const yawOk = still && ratios.length > 10 && facing.length >= seen.length * 0.6
  const faceWidth: FaceMetric = yawOk
    ? { value: Math.round(median(ratios) * 1000) / 1000, ok: true, quality: presence, note: 'Cheek width ÷ distance between pupils (median of frames).' }
    : fail('Keep the head still and facing the camera.')
  if (frac < 0.15) faceWidth.note += ' Face is small in frame — move closer next time.'

  return { durationS, presence, hr, resp, blinkRate, perclos, faceWidth }
}
