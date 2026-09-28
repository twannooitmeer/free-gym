'use server'

import { getPayload } from 'payload'

import { getSession } from '@/lib/session'
import { isExpired, MAX_ATTEMPTS } from '@/lib/verification'
import { consumeVerificationAttempt } from '@/lib/db'
import config from '@/payload.config'

type ActionResult = { ok: true } | { ok: false; error: string }

/**
 * Verify the signed-in customer's email by matching their 6-digit code.
 *
 * Failure modes (string error codes for the form):
 * - not-authenticated: no session
 * - wrong-role:        signed in but not as a customer
 * - already-verified:  no-op success path? we return ok:true so the UI redirects
 * - no-code:           customer has no active code (must request a resend)
 * - expired:           code TTL elapsed
 * - too-many-attempts: burned this code, must resend
 * - invalid:           code doesn't match (attempt counter incremented)
 */
export async function verifyEmail(input: { code: string }): Promise<ActionResult> {
  const code = (input.code ?? '').trim()
  if (!/^\d{6}$/.test(code)) return { ok: false, error: 'invalid' }

  const authSession = await getSession()
  if (!authSession?.user) return { ok: false, error: 'not-authenticated' }
  if (authSession.user.role !== 'customers') return { ok: false, error: 'wrong-role' }

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  let customer
  try {
    customer = await payload.findByID({
      collection: 'customers',
      id: authSession.user.id,
      overrideAccess: true,
    })
  } catch {
    return { ok: false, error: 'not-authenticated' }
  }

  if (customer.emailVerified) return { ok: true }

  const stored = customer.verificationCode as string | null | undefined
  const expiresAt = customer.verificationExpiresAt as string | null | undefined

  if (!stored) return { ok: false, error: 'no-code' }
  if (isExpired(expiresAt)) return { ok: false, error: 'expired' }
  // Every attempt, right or wrong, uses one of MAX_ATTEMPTS, atomically.
  if (!(await consumeVerificationAttempt(payload, customer.id, MAX_ATTEMPTS))) {
    return { ok: false, error: 'too-many-attempts' }
  }
  if (stored !== code) return { ok: false, error: 'invalid' }

  // Success: clear the code so it can't be replayed.
  try {
    await payload.update({
      collection: 'customers',
      id: customer.id,
      data: {
        emailVerified: true,
        verificationCode: null,
        verificationExpiresAt: null,
        verificationAttempts: 0,
      },
      overrideAccess: true,
    })
  } catch {
    return { ok: false, error: 'failed' }
  }

  return { ok: true }
}
