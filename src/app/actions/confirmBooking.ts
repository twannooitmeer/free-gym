'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'

import { getSession } from '@/lib/session'
import { sendEmail } from '@/lib/email'
import { getEmailConfig } from '@/lib/emailConfig'
import { bookingConfirmationEmail } from '@/lib/emails/messages'
import { loadActiveMemberships } from '@/lib/memberships'
import { createBookingAtomically } from '@/lib/booking'
import { qrImageUrl } from '@/lib/checkIn'
import { quoteBookingPrice } from '@/lib/pricing'
import { getGymProfile } from '@/lib/gymProfile'
import config from '@/payload.config'

type ActionResult =
  | { ok: true; bookingId: number; free: boolean; usedCredit: boolean }
  | { ok: false; error: string }

/**
 * Confirm and persist a booking after the customer has reviewed the price
 * on /book/[sessionId]. Pricing is recomputed server-side so the client
 * can't lie about whether the session is free.
 *
 * Membership handling:
 * - We load the customer's active memberships and pick the best one
 *   (unlimited > credits) via quoteBookingPrice.
 * - When a credits-membership is chosen, the booking and the credit charge
 *   are one transaction (lib/booking.ts). If the pack ran out in the
 *   meantime, nothing is written and the customer sees 'credits-changed'.
 *
 * Auth: signed-in customers only. The /book page redirects to /signup
 * first when there's no session, so by the time we get here we expect
 * an authenticated customer.
 */
export async function confirmBooking(
  sessionId: string | number,
  locale: 'nl' | 'en' = 'nl',
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
    return { ok: false, error: 'customer-not-found' }
  }

  // Defensive check: the /book page already gates on this, but if the
  // action is hit directly by a script we still refuse. Skipped when
  // email verification is disabled in admin settings.
  const emailCfg = await getEmailConfig()
  if (emailCfg.verificationRequired && !customer.emailVerified) {
    return { ok: false, error: 'unverified' }
  }

  let sessionDoc
  try {
    sessionDoc = await payload.findByID({
      collection: 'sessions',
      id: Number(sessionId),
      depth: 1,
      overrideAccess: true,
    })
  } catch {
    return { ok: false, error: 'session-not-found' }
  }

  if (sessionDoc.status === 'cancelled') {
    return { ok: false, error: 'cancelled' }
  }
  if (new Date(sessionDoc.startsAt).getTime() <= Date.now()) {
    return { ok: false, error: 'started' }
  }

  const sessionType =
    typeof sessionDoc.type === 'object' && sessionDoc.type
      ? sessionDoc.type
      : { id: undefined, priceCents: 0, coveredByMembership: false }

  const activeMemberships = await loadActiveMemberships(payload, customer.id)
  const quote = quoteBookingPrice(sessionType, customer, activeMemberships)

  // Map quote reason to the Bookings.paymentStatus enum.
  const paymentStatus = quote.free
    ? quote.reason === 'credit'
      ? 'credit'
      : 'free'
    : 'unpaid'

  const created = await createBookingAtomically(payload, customer, {
    sessionId: Number(sessionId),
    paymentStatus,
    amountCents: quote.amountCents,
    charge:
      quote.chargeMembershipId && quote.creditsUsed > 0
        ? { membershipId: quote.chargeMembershipId, credits: quote.creditsUsed }
        : quote.chargeMembershipId
          ? { membershipId: quote.chargeMembershipId, credits: 0 }
          : undefined,
  })
  if (!created.ok) return { ok: false, error: created.error }

  revalidatePath('/[locale]/schedule', 'page')
  revalidatePath('/[locale]/me', 'page')

  // Best-effort confirmation email. Never block the booking on mail issues.
  try {
    const className =
      (typeof sessionDoc.type === 'object' && sessionDoc.type && 'name' in sessionDoc.type
        ? String((sessionDoc.type as { name?: string }).name ?? '')
        : '') ||
      sessionDoc.title ||
      'Class'
    const teacherName =
      typeof sessionDoc.teacher === 'object' && sessionDoc.teacher && 'name' in sessionDoc.teacher
        ? String((sessionDoc.teacher as { name?: string }).name ?? '')
        : ''
    const paymentNote =
      paymentStatus === 'unpaid' && quote.amountCents > 0
        ? locale === 'nl'
          ? `Betaal aan de balie (${(quote.amountCents / 100).toFixed(2).replace('.', ',')} EUR)`
          : `Pay at the desk (${(quote.amountCents / 100).toFixed(2)} EUR)`
        : null

    const gym = await getGymProfile(locale)
    const msg = bookingConfirmationEmail({
      gymName: gym.name,
      registrationUrl: `${(process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')}/${locale}/me/bookings/${created.booking.id}`,
      qrImageUrl: created.booking.checkInCode ? qrImageUrl(created.booking.checkInCode) : null,
      name: customer.name ?? '',
      locale,
      className,
      teacherName,
      startsAtIso: String(sessionDoc.startsAt),
      location: sessionDoc.location ?? gym.defaultLocation,
      paymentNote,
    })
    void sendEmail({
      to: customer.email,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    })
  } catch (err) {
    console.error('[confirmBooking] email build failed', { err })
  }

  return {
    ok: true,
    bookingId: created.booking.id,
    free: quote.free,
    usedCredit: quote.reason === 'credit',
  }
}
