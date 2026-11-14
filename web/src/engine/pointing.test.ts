import { describe, expect, it } from 'vitest'
import { locateTouch, TouchHold } from './pointing'
import type { PoseFrame } from '../vision/camera'

// A person standing facing the camera (normalised image coords; person's left = image right).
const J: Record<number, [number, number]> = {
  0: [0.5, 0.12], 7: [0.54, 0.12], 8: [0.46, 0.12],
  11: [0.58, 0.25], 12: [0.42, 0.25], 13: [0.62, 0.38], 14: [0.38, 0.38], 15: [0.63, 0.5], 16: [0.37, 0.5],
  23: [0.55, 0.52], 24: [0.45, 0.52], 25: [0.55, 0.7], 26: [0.45, 0.7], 27: [0.55, 0.88], 28: [0.45, 0.88],
  31: [0.56, 0.95], 32: [0.44, 0.95],
}
const pose = (vis = 0.95, noseVis = 0.95): PoseFrame => {
  const xyv = new Float32Array(33 * 3)
  for (let i = 0; i < 33; i++) {
    const [x, y] = J[i] ?? [0.5, 0.5]
    xyv.set([x, y, i === 0 ? noseVis : J[i] ? vis : 0], i * 3)
  }
  return { xyv, aspect: 1 }
}
const hand = (tip: [number, number], wrist: [number, number]) => ({ tip, wrist, pip: tip })

describe('point to pain', () => {
  it('right hand touching the left knee → left knee', () => {
    const hit = locateTouch(pose(), [hand([0.55, 0.705], [0.4, 0.62])])
    expect(hit?.region).toBe('knee')
    expect(hit?.side).toBe('left')
  })
  it('left hand on the right thigh → right thigh', () => {
    expect(locateTouch(pose(), [hand([0.45, 0.6], [0.6, 0.52])])).toMatchObject({ region: 'thigh', side: 'right' })
  })
  it('ignores the pointing arm itself', () => {
    // right hand's tip sits on its own forearm line only → no own-arm hit, nearest other part or null
    const hit = locateTouch(pose(), [hand([0.37, 0.47], [0.37, 0.5])])
    expect(hit?.region === 'arm' && hit.side === 'right').toBe(false)
  })
  it('facing away turns the trunk into back regions', () => {
    const hit = locateTouch(pose(0.95, 0.1), [hand([0.5, 0.48], [0.62, 0.5])])
    expect(hit?.region).toBe('lower_back')
  })
  it('hand far from the body → nothing', () => {
    expect(locateTouch(pose(), [hand([0.95, 0.1], [0.9, 0.2])])).toBeNull()
  })
  it('hold must be steady before confirming', () => {
    const h = new TouchHold(1000)
    const hit = { region: 'knee' as const, side: 'left' as const, dist: 0.1, hand: 0, tip: [0, 0] as [number, number] }
    expect(h.update(0, hit).confirmed).toBe(false)
    expect(h.update(1000, hit).confirmed).toBe(true)
    expect(h.update(1100, { ...hit, side: 'right' }).confirmed).toBe(false)
  })
})
