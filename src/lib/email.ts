/**
 * Tiny email sender backed by Resend's HTTPS API.
 *
 * Why a hand-rolled fetch wrapper instead of the `resend` SDK?
 * - Zero extra dependency. Keeps the bundle lean.
 * - Easy to swap for SendGrid/Postmark/Mailgun later: the only thing
 *   callers see is `sendEmail({ to, subject, html, text })`.
 * - Works behind any firewall: pure HTTPS POST on port 443. DigitalOcean
 *   (and most VPS providers) block outbound SMTP by default; HTTPS APIs
 *   sidestep that entirely.
 *
 * Config resolution: src/lib/emailConfig.ts reads the `email` admin
 * global first and falls back to RESEND_API_KEY / EMAIL_FROM env vars.
 *
 * Failures are logged but never thrown. Email is best-effort: a signup
 * or booking should never fail because the mail provider had a hiccup.
 */

import { getEmailConfig } from './emailConfig'

export type EmailMessage = {
  to: string | string[]
  subject: string
  html: string
  text: string
  replyTo?: string
}

type ResendError = { name?: string; message?: string }

export async function sendEmail(msg: EmailMessage): Promise<{ ok: boolean; id?: string }> {
  const cfg = await getEmailConfig()

  if (!cfg.apiKey || !cfg.fromAddress) {
    // In dev / local you usually don't want real mail to fire. Log a
    // preview to the console so you can see what would have been sent.
    console.warn('[email] provider not configured (no API key or From address), skipping send', {
      to: msg.to,
      subject: msg.subject,
      text: msg.text.slice(0, 200),
    })
    return { ok: false }
  }

  if (cfg.provider !== 'resend') {
    // Stub: SendGrid wiring lives here when we add it.
    console.warn('[email] provider not implemented, skipping send', {
      provider: cfg.provider,
      to: msg.to,
    })
    return { ok: false }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: cfg.fromAddress,
        to: Array.isArray(msg.to) ? msg.to : [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        reply_to: msg.replyTo,
      }),
    })

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as ResendError
      console.error('[email] resend send failed', {
        status: res.status,
        to: msg.to,
        subject: msg.subject,
        err: body.message ?? body.name,
      })
      return { ok: false }
    }

    const body = (await res.json().catch(() => ({}))) as { id?: string }
    return { ok: true, id: body.id }
  } catch (err) {
    console.error('[email] resend send threw', {
      to: msg.to,
      subject: msg.subject,
      err: err instanceof Error ? err.message : String(err),
    })
    return { ok: false }
  }
}
