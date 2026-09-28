'use server'

import { getPayload } from 'payload'

import { getSession } from '@/lib/session'
import { sendEmail } from '@/lib/email'
import { verificationEmail } from '@/lib/emails/messages'
import {
  CODE_TTL_MIN,
  codeExpiresAt,
  generateCode,
  RESEND_COOLDOWN_SEC,
} from '@/lib/verification'
import { getGymProfile } from '@/lib/gymProfile'
import config from '@/payload.config'

type ActionResult = { ok: true } | { ok: false; error: string; retryInSec?: number }

/**
 * Generate a fresh code, store it on the customer, and email it.
 * Throttled with a per-customer cooldown so the Resend free tier doesn't
 * burn on accidental double-clicks.
 */
export async function resendVerification(
  input: { locale?: 'nl' | 'en' } = {},
): Promise<ActionResult> {
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

  const sentAt = customer.verificationSentAt as string | null | undefined
  if (sentAt) {
    const elapsed = (Date.now() - new Date(sentAt).getTime()) / 1000
    if (elapsed < RESEND_COOLDOWN_SEC) {
      return {
        ok: false,
        error: 'rate-limited',
        retryInSec: Math.ceil(RESEND_COOLDOWN_SEC - elapsed),
      }
    }
  }

  const code = generateCode()
  const expiresAt = codeExpiresAt()

  try {
    await payload.update({
      collection: 'customers',
      id: customer.id,
      data: {
        verificationCode: code,
        verificationExpiresAt: expiresAt.toISOString(),
        verificationAttempts: 0,
        verificationSentAt: new Date().toISOString(),
      },
      overrideAccess: true,
    })
  } catch {
    return { ok: false, error: 'failed' }
  }

  const locale = input.locale === 'en' ? 'en' : 'nl'
  const msg = verificationEmail({
    name: customer.name ?? '',
    code,
    locale,
    ttlMinutes: CODE_TTL_MIN,
    gymName: (await getGymProfile(locale)).name,
  })
  void sendEmail({
    to: customer.email,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  })

  return { ok: true }
}
