import { describe, expect, it } from 'vitest'
import { demoState } from './demo'
import { crewStatus } from './store'
import { worst } from '../engine/status'

// The demo must show every status the app can produce, so judges see each one.
describe('demo crew', () => {
  const d = demoState()
  const state = { ...d, loaded: true, online: false, account: null }
  const overall = Object.fromEntries(d.crew.map((c) => [c.id, worst(Object.values(crewStatus(state, c.id)).map((r) => r.level))]))
  it('covers Usual / Watch / Act / No data', () => {
    expect(overall).toEqual({ CDR: 'usual', PLT: 'act', MS1: 'watch', MS2: 'nodata' })
  })
})
