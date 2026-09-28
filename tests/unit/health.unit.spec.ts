import { describe, expect, it } from 'vitest'

import { checkHealth, HEALTH_KEYS } from '@/lib/health'

/**
 * Pins the health contract monitors depend on: key set, enum values,
 * status codes and size. A change here is a change to every monitor.
 */
describe('health check', () => {
  it('ok: 200, exact keys, tiny', async () => {
    const { body, code } = await checkHealth(async () => {})
    expect(code).toBe(200)
    expect(body).toEqual({ status: 'ok', db: 'ok' })
    expect(Object.keys(body).sort()).toEqual([...HEALTH_KEYS])
    expect(JSON.stringify(body)).toContain('"status":"ok"')
    expect(new TextEncoder().encode(JSON.stringify(body)).length).toBeLessThan(1024)
  })

  it('database down: 503 and nothing but enums', async () => {
    const { body, code } = await checkHealth(async () => {
      throw new Error('connect ECONNREFUSED 10.0.0.5:5432 password=secret')
    })
    expect(code).toBe(503)
    expect(body).toEqual({ status: 'down', db: 'down' })
    expect(JSON.stringify(body)).not.toMatch(/ECONN|5432|secret/)
  })

  it('a hanging database counts as down', async () => {
    const { code } = await checkHealth(() => new Promise(() => {}))
    expect(code).toBe(503)
  }, 5000)
})
