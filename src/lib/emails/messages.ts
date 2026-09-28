/**
 * Email message bodies. Kept as plain functions so they're trivial to
 * unit-test and don't pull in a templating engine.
 *
 * Each builder returns both an HTML and a plain-text version. Always
 * include both: deliverability scoring penalises HTML-only mail.
 *
 * Style notes:
 * - No em-dashes anywhere in user-facing copy (house rule).
 * - Use SITE_URL when present so links in production resolve to the
 *   real domain instead of localhost.
 */

type Locale = 'nl' | 'en'

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3000'
// The gym's wall clock; the compose file sets TZ on the container.
const TIME_ZONE = process.env.TZ || 'Europe/Amsterdam'

// ---------- helpers ----------

function fmtDateTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }).format(new Date(iso))
}

function shell(bodyHtml: string, gymName: string): string {
  // Minimal HTML wrapper. Keep inline styles for max-client compatibility.
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#111;color:#eee;font-family:Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="font-size:20px;font-weight:700;letter-spacing:0.04em;color:#fff;margin-bottom:24px;">${escapeHtml(gymName.toUpperCase())}</div>
    ${bodyHtml}
    <hr style="border:none;border-top:1px solid #333;margin:32px 0;"/>
    <div style="font-size:12px;color:#888;">
      ${escapeHtml(gymName)} &middot; <a href="${SITE_URL}" style="color:#dc2626;text-decoration:none;">${SITE_URL}</a>
    </div>
  </div>
</body></html>`
}

// ---------- welcome ----------

export function welcomeEmail(opts: { name: string; locale: Locale; gymName: string }): {
  subject: string
  html: string
  text: string
} {
  const { name, locale, gymName } = opts
  const meUrl = `${SITE_URL}/${locale}/me`
  const scheduleUrl = `${SITE_URL}/${locale}/schedule`

  if (locale === 'nl') {
    const subject = `Welkom bij ${gymName}`
    const html = shell(`
      <h1 style="font-size:24px;color:#fff;margin:0 0 16px;">Welkom, ${escapeHtml(name)}.</h1>
      <p style="line-height:1.5;">Je account is aangemaakt. Je kunt nu lessen boeken en je profiel beheren.</p>
      <p style="margin:24px 0;">
        <a href="${scheduleUrl}" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;font-weight:600;">Bekijk het rooster</a>
      </p>
      <p style="line-height:1.5;color:#bbb;">Of ga naar <a href="${meUrl}" style="color:#dc2626;">je profiel</a>.</p>
    `, gymName)
    const text = [
      `Welkom, ${name}.`,
      '',
      'Je account is aangemaakt. Je kunt nu lessen boeken en je profiel beheren.',
      '',
      `Rooster: ${scheduleUrl}`,
      `Profiel: ${meUrl}`,
    ].join('\n')
    return { subject, html, text }
  }

  const subject = `Welcome to ${gymName}`
  const html = shell(`
    <h1 style="font-size:24px;color:#fff;margin:0 0 16px;">Welcome, ${escapeHtml(name)}.</h1>
    <p style="line-height:1.5;">Your account is ready. You can now book classes and manage your profile.</p>
    <p style="margin:24px 0;">
      <a href="${scheduleUrl}" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;font-weight:600;">View the schedule</a>
    </p>
    <p style="line-height:1.5;color:#bbb;">Or head to <a href="${meUrl}" style="color:#dc2626;">your profile</a>.</p>
  `, gymName)
  const text = [
    `Welcome, ${name}.`,
    '',
    'Your account is ready. You can now book classes and manage your profile.',
    '',
    `Schedule: ${scheduleUrl}`,
    `Profile: ${meUrl}`,
  ].join('\n')
  return { subject, html, text }
}

// ---------- email verification ----------

export function verificationEmail(opts: {
  name: string
  code: string
  locale: Locale
  ttlMinutes: number
  gymName: string
}): { subject: string; html: string; text: string } {
  const { name, code, locale, ttlMinutes, gymName } = opts

  if (locale === 'nl') {
    const subject = `Je verificatiecode: ${code}`
    const html = shell(`
      <h1 style="font-size:22px;color:#fff;margin:0 0 16px;">Verifieer je e-mailadres</h1>
      <p style="line-height:1.5;">Hi ${escapeHtml(name)}, gebruik deze code om je account te bevestigen:</p>
      <p style="margin:24px 0;font-size:32px;font-weight:700;letter-spacing:0.3em;color:#fff;font-family:Menlo,Consolas,monospace;">${escapeHtml(code)}</p>
      <p style="line-height:1.5;color:#bbb;">De code is ${ttlMinutes} minuten geldig. Na verificatie kun je lessen boeken.</p>
      <p style="line-height:1.5;color:#bbb;">Heb je je niet aangemeld? Negeer deze e-mail.</p>
    `, gymName)
    const text = [
      `Verifieer je e-mailadres.`,
      '',
      `Code: ${code}`,
      `Geldig: ${ttlMinutes} minuten.`,
      '',
      'Heb je je niet aangemeld? Negeer deze e-mail.',
    ].join('\n')
    return { subject, html, text }
  }

  const subject = `Your verification code: ${code}`
  const html = shell(`
    <h1 style="font-size:22px;color:#fff;margin:0 0 16px;">Verify your email</h1>
    <p style="line-height:1.5;">Hi ${escapeHtml(name)}, use this code to confirm your account:</p>
    <p style="margin:24px 0;font-size:32px;font-weight:700;letter-spacing:0.3em;color:#fff;font-family:Menlo,Consolas,monospace;">${escapeHtml(code)}</p>
    <p style="line-height:1.5;color:#bbb;">The code is valid for ${ttlMinutes} minutes. After verifying you can book classes.</p>
    <p style="line-height:1.5;color:#bbb;">Didn't sign up? Ignore this email.</p>
  `, gymName)
  const text = [
    `Verify your email.`,
    '',
    `Code: ${code}`,
    `Valid for: ${ttlMinutes} minutes.`,
    '',
    `Didn't sign up? Ignore this email.`,
  ].join('\n')
  return { subject, html, text }
}

// ---------- booking confirmation ----------

export function bookingConfirmationEmail(opts: {
  name: string
  locale: Locale
  className: string
  teacherName: string
  startsAtIso: string
  location: string
  paymentNote: string | null // e.g. "Betaal aan de balie (12,00 EUR)" or null when free/credit
  gymName: string
  /** The customer's registration page, with the show-code button. */
  registrationUrl: string
  /** Hosted PNG of the check-in QR code (mail clients block inline data: images). */
  qrImageUrl: string | null
}): { subject: string; html: string; text: string } {
  const { name, locale, className, teacherName, startsAtIso, location, paymentNote, gymName } = opts
  const { registrationUrl, qrImageUrl } = opts
  const when = fmtDateTime(startsAtIso, locale)
  const meUrl = registrationUrl
  const qrBlock = (alt: string, caption: string) =>
    qrImageUrl
      ? `<div style="margin:24px 0;text-align:center;">
      <img src="${qrImageUrl}" width="200" height="200" alt="${escapeHtml(alt)}" style="background:#fff;padding:8px;border-radius:8px;"/>
      <p style="font-size:13px;color:#bbb;margin:8px 0 0;">${escapeHtml(caption)}</p>
    </div>`
      : ''

  if (locale === 'nl') {
    const subject = `Boeking bevestigd: ${className} op ${when}`
    const html = shell(`
      <h1 style="font-size:22px;color:#fff;margin:0 0 16px;">Boeking bevestigd</h1>
      <p style="line-height:1.5;">Hi ${escapeHtml(name)}, je plek is gereserveerd.</p>
      <table style="margin:24px 0;font-size:14px;line-height:1.6;color:#ddd;">
        <tr><td style="color:#888;padding-right:16px;">Les</td><td>${escapeHtml(className)}</td></tr>
        <tr><td style="color:#888;padding-right:16px;">Docent</td><td>${escapeHtml(teacherName)}</td></tr>
        <tr><td style="color:#888;padding-right:16px;">Wanneer</td><td>${escapeHtml(when)}</td></tr>
        <tr><td style="color:#888;padding-right:16px;">Locatie</td><td>${escapeHtml(location)}</td></tr>
        ${paymentNote ? `<tr><td style="color:#888;padding-right:16px;">Betaling</td><td>${escapeHtml(paymentNote)}</td></tr>` : ''}
      </table>
      ${qrBlock('Check-in code', 'Laat deze code zien aan de balie.')}
      <p style="line-height:1.5;color:#bbb;">Je code en je boeking staan ook op <a href="${meUrl}" style="color:#dc2626;">je inschrijving</a>. Kun je niet komen? Daar kun je ook annuleren.</p>
    `, gymName)
    const text = [
      `Boeking bevestigd: ${className} op ${when}.`,
      '',
      `Docent: ${teacherName}`,
      `Locatie: ${location}`,
      paymentNote ? `Betaling: ${paymentNote}` : null,
      '',
      `Je inschrijving, check-in code en annuleren: ${meUrl}`,
    ]
      .filter(Boolean)
      .join('\n')
    return { subject, html, text }
  }

  const subject = `Booking confirmed: ${className} on ${when}`
  const html = shell(`
    <h1 style="font-size:22px;color:#fff;margin:0 0 16px;">Booking confirmed</h1>
    <p style="line-height:1.5;">Hi ${escapeHtml(name)}, your spot is reserved.</p>
    <table style="margin:24px 0;font-size:14px;line-height:1.6;color:#ddd;">
      <tr><td style="color:#888;padding-right:16px;">Class</td><td>${escapeHtml(className)}</td></tr>
      <tr><td style="color:#888;padding-right:16px;">Teacher</td><td>${escapeHtml(teacherName)}</td></tr>
      <tr><td style="color:#888;padding-right:16px;">When</td><td>${escapeHtml(when)}</td></tr>
      <tr><td style="color:#888;padding-right:16px;">Where</td><td>${escapeHtml(location)}</td></tr>
      ${paymentNote ? `<tr><td style="color:#888;padding-right:16px;">Payment</td><td>${escapeHtml(paymentNote)}</td></tr>` : ''}
    </table>
    ${qrBlock('Check-in code', 'Show this code at the counter.')}
    <p style="line-height:1.5;color:#bbb;">Your code and booking are also on <a href="${meUrl}" style="color:#dc2626;">your registration</a>. Cannot make it? You can cancel there too.</p>
  `, gymName)
  const text = [
    `Booking confirmed: ${className} on ${when}.`,
    '',
    `Teacher: ${teacherName}`,
    `Where: ${location}`,
    paymentNote ? `Payment: ${paymentNote}` : null,
    '',
    `Your registration, check-in code and cancelling: ${meUrl}`,
  ]
    .filter(Boolean)
    .join('\n')
  return { subject, html, text }
}

// ---------- util ----------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
