import { randomBytes } from 'node:crypto'

/**
 * Check-in codes. (The "class is coming up" timing is in countdown.ts,
 * which has no Node imports so client components can use it.)
 *
 * Every booking gets a random code at creation. The QR code a customer
 * shows at the counter encodes the check-in URL for that code; staff who
 * scan it can mark the booking attended. 128 random bits, so a code cannot
 * be guessed or enumerated; it is the only thing the URL carries.
 */

const CODE_BYTES = 16
const CODE_PATTERN = /^[A-Za-z0-9_-]{22}$/

export function generateCheckInCode(): string {
  return randomBytes(CODE_BYTES).toString('base64url')
}

/** Cheap format check before any database lookup. */
export function isCheckInCode(value: unknown): value is string {
  return typeof value === 'string' && CODE_PATTERN.test(value)
}

/** Path of the staff check-in page for a code (locale-less; middleware adds it). */
export function checkInPath(code: string): string {
  return `/checkin/${code}`
}
