import { randomInt } from 'node:crypto'

/**
 * Helpers for the customer email-verification flow.
 *
 * Codes are 6-digit numeric so they're trivial to type from a phone. They
 * live for 15 minutes and tolerate 5 wrong attempts before being burned
 * and requiring a resend. Codes are stored in plaintext on the customer
 * row, but the field has access.read = () => false so they never leave
 * the server.
 */

export const CODE_LENGTH = 6
export const CODE_TTL_MIN = 15
export const MAX_ATTEMPTS = 5
export const RESEND_COOLDOWN_SEC = 60

export function generateCode(): string {
  // randomInt is uniform; Math.random isn't. Use crypto since this is
  // auth-adjacent even if the codes are short and short-lived.
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, '0')
}

export function codeExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + CODE_TTL_MIN * 60_000)
}

export function isExpired(expiresAtIso: string | null | undefined): boolean {
  if (!expiresAtIso) return true
  return new Date(expiresAtIso).getTime() < Date.now()
}
