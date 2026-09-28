import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * True when the request carries `Authorization: Bearer $CRON_SECRET`.
 * Compared in constant time (over hashes, so lengths never differ).
 */
export function isCronAuthorized(header: string | null, secret: string): boolean {
  const digest = (s: string) => createHash('sha256').update(s).digest()
  return timingSafeEqual(digest(header ?? ''), digest(`Bearer ${secret}`))
}
