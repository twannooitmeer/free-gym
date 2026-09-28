import { afterEach, describe, expect, it } from 'vitest'

import { freezeInDemo } from '@/access/roles'
import { Teachers } from '@/collections/Teachers'
import { isDemoMode } from '@/lib/demo'

import { assertDemoResetAllowed } from '../../scripts/demo-reset-guard'

const run = (user: unknown, payloadAPI = 'REST') =>
  (freezeInDemo as (a: unknown) => unknown)({
    data: { password: 'x' },
    operation: 'update',
    req: { user, payloadAPI, t: (k: string) => k },
  })

describe('demo mode', () => {
  afterEach(() => {
    delete process.env.DEMO_MODE
  })

  it('is off unless DEMO_MODE is exactly 1', () => {
    expect(isDemoMode()).toBe(false)
    process.env.DEMO_MODE = 'true'
    expect(isDemoMode()).toBe(false)
    process.env.DEMO_MODE = '1'
    expect(isDemoMode()).toBe(true)
  })

  it('freezes the shared teacher account in a demo, and only there', () => {
    const teacher = { id: 1, collection: 'teachers' }
    expect(() => run(teacher)).not.toThrow()
    process.env.DEMO_MODE = '1'
    expect(() => run(teacher)).toThrow()
    expect(() => run({ id: 1, collection: 'admins' })).not.toThrow()
    expect(() => run(null, 'local')).not.toThrow()
    expect(Teachers.hooks?.beforeChange).toContain(freezeInDemo)
  })

  it('demo:reset refuses to wipe anything outside demo mode', () => {
    expect(() => assertDemoResetAllowed({})).toThrow(/DEMO_MODE=1/)
    expect(() => assertDemoResetAllowed({ DEMO_MODE: 'true' })).toThrow()
    expect(() => assertDemoResetAllowed({ DEMO_MODE: '1' })).not.toThrow()
  })
})
