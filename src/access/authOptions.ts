import type { IncomingAuthType } from 'payload'

/**
 * Auth settings shared by the three auth collections.
 *
 * - The session cookie is HTTP-only (Payload's default), SameSite=Lax, and
 *   Secure in production.
 * - Five wrong passwords lock the account for ten minutes. This is
 *   Payload's built-in brute-force brake; it also means someone who knows
 *   an email can lock that account for ten minutes, the usual trade-off.
 */
export function authOptions(tokenExpirationSeconds: number): IncomingAuthType {
  return {
    tokenExpiration: tokenExpirationSeconds,
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000,
    cookies: {
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    },
  }
}

/** Members stay signed in for 30 days; staff sessions are shorter. */
export const MEMBER_SESSION_SECONDS = 30 * 24 * 60 * 60
export const STAFF_SESSION_SECONDS = 12 * 60 * 60
