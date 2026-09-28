/**
 * Health check body. Small-footprint rule: under 1 KB, enum values only
 * (no names, ids, counts or error text), never cached, and 503 when a hard
 * dependency is down. Postgres is the only hard dependency; email is
 * best-effort and not part of health.
 */
export type Health = { status: 'ok' | 'down'; db: 'ok' | 'down' }

export const HEALTH_KEYS = ['db', 'status'] as const

const PING_TIMEOUT_MS = 2000

/** Run the database ping with a timeout and turn the outcome into the body + status code. */
export async function checkHealth(ping: () => Promise<unknown>): Promise<{ body: Health; code: 200 | 503 }> {
  let dbOk = false
  try {
    await Promise.race([
      ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), PING_TIMEOUT_MS)),
    ])
    dbOk = true
  } catch {
    dbOk = false
  }
  const body: Health = { status: dbOk ? 'ok' : 'down', db: dbOk ? 'ok' : 'down' }
  return { body, code: dbOk ? 200 : 503 }
}
