'use server'

import { getPayload } from 'payload'

import { signIn } from '@/app/actions/auth'
import { sendEmail } from '@/lib/email'
import { getEmailConfig } from '@/lib/emailConfig'
import { verificationEmail } from '@/lib/emails/messages'
import { CODE_TTL_MIN, codeExpiresAt, generateCode } from '@/lib/verification'
import { getGymProfile } from '@/lib/gymProfile'
import config from '@/payload.config'

type SignupInput = {
  name: string
  email: string
  password: string
  locale?: 'nl' | 'en'
}

type ActionResult = { ok: true; signedIn: boolean } | { ok: false; error: string }

/**
 * Create a new customer account.
 *
 * - Anyone can call this (Customers.access.create = anyone).
 * - Email confirmation is NOT enforced yet; we'll add a verification token
 *   + email send in a follow-up. For v1 the desk admin can sanity-check
 *   new sign-ups via the Payload admin.
 * - On success the new customer is signed in (Payload session cookie), so
 *   the form can go straight to /verify.
 */
export async function signupCustomer(input: SignupInput): Promise<ActionResult> {
  const name = (input.name ?? '').trim()
  const email = (input.email ?? '').trim().toLowerCase()
  const password = input.password ?? ''

  if (name.length < 1) return { ok: false, error: 'name-required' }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'invalid-email' }
  if (password.length < 8) return { ok: false, error: 'weak-password' }

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  // Check for an existing customer first so we can return a clean error
  // instead of leaking the underlying unique-constraint failure.
  const existing = await payload.find({
    collection: 'customers',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.totalDocs > 0) {
    return { ok: false, error: 'email-in-use' }
  }

  const code = generateCode()
  const expiresAt = codeExpiresAt()

  // Verification is admin-toggleable. When off, new customers are
  // marked verified immediately and skip the code email entirely.
  const emailCfg = await getEmailConfig()
  const verificationRequired = emailCfg.verificationRequired

  try {
    await payload.create({
      collection: 'customers',
      data: {
        name,
        email,
        password,
        membershipStatus: 'none',
        emailVerified: !verificationRequired,
        verificationCode: verificationRequired ? code : null,
        verificationExpiresAt: verificationRequired ? expiresAt.toISOString() : null,
        verificationAttempts: 0,
        verificationSentAt: verificationRequired ? new Date().toISOString() : null,
      },
      overrideAccess: true,
    })
  } catch {
    return { ok: false, error: 'failed' }
  }

  if (verificationRequired) {
    // Best-effort verification email. Never block signup on mail provider issues;
    // the user can hit "Resend code" on /verify if it never arrives.
    const locale = input.locale === 'en' ? 'en' : 'nl'
    const msg = verificationEmail({
      name,
      code,
      locale,
      ttlMinutes: CODE_TTL_MIN,
      gymName: (await getGymProfile(locale)).name,
    })
    void sendEmail({ to: email, subject: msg.subject, html: msg.html, text: msg.text })
  }

  const signedIn = await signIn('customer', email, password)
  return { ok: true, signedIn: signedIn.ok }
}
