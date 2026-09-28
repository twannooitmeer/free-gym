/**
 * Single source of truth for transactional email configuration.
 *
 * Loads the `email` global from Payload and falls back to environment
 * variables when fields are blank. Lets the admin override at runtime
 * without redeploying, while keeping local dev frictionless.
 *
 * Cached for the request lifecycle because every email-sending action
 * tends to read this immediately before calling `sendEmail`.
 */

import { getPayload } from 'payload'

import config from '@/payload.config'

export type EmailConfig = {
  provider: 'resend' | 'sendgrid'
  apiKey: string | null
  fromAddress: string | null
  verificationRequired: boolean
}

let cached: { value: EmailConfig; ts: number } | null = null
const TTL_MS = 30_000 // Re-read at most twice per minute.

export async function getEmailConfig(): Promise<EmailConfig> {
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.value

  let provider: EmailConfig['provider'] = 'resend'
  let apiKey: string | null = null
  let fromAddress: string | null = null
  let verificationRequired = false

  try {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })
    const g = await payload.findGlobal({ slug: 'email', depth: 0, overrideAccess: true })
    const p = (g as { provider?: string }).provider
    if (p === 'resend' || p === 'sendgrid') provider = p
    const f = (g as { fromAddress?: string | null }).fromAddress
    fromAddress = typeof f === 'string' && f.trim() !== '' ? f.trim() : null
    const k = (g as { apiKey?: string | null }).apiKey
    apiKey = typeof k === 'string' && k.trim() !== '' ? k.trim() : null
    verificationRequired = (g as { verificationRequired?: boolean }).verificationRequired === true
  } catch (err) {
    // Global may not be initialised yet (fresh install). Fall through
    // to env vars so the system stays functional.
    console.warn('[emailConfig] could not load email global, falling back to env', {
      err: err instanceof Error ? err.message : String(err),
    })
  }

  // Env fallback for both fields. Useful in CI and on first boot.
  if (!apiKey) apiKey = process.env.RESEND_API_KEY?.trim() || null
  if (!fromAddress) fromAddress = process.env.EMAIL_FROM?.trim() || null

  const value: EmailConfig = { provider, apiKey, fromAddress, verificationRequired }
  cached = { value, ts: Date.now() }
  return value
}

/** Invalidate the cache. Call from the Email global's afterChange hook
 *  so admin edits take effect immediately. */
export function invalidateEmailConfig(): void {
  cached = null
}
