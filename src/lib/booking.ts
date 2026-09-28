import {
  commitTransaction,
  createLocalReq,
  initTransaction,
  killTransaction,
  type Payload,
} from 'payload'

import type { Booking, Customer } from '@/payload-types'

import { lockBooking, refundCredits, spendCredits } from './db'
import type { BookingError } from './scheduling'

type Charge = { membershipId: number | string; credits: number }

export type CreateBookingInput = {
  sessionId: number
  paymentStatus: Booking['paymentStatus']
  amountCents: number
  charge?: Charge
}

class CreditsChanged extends Error {}

/** Map whatever a failed booking write threw to a stable error code. */
export function classifyBookingError(err: unknown): BookingError {
  if (err instanceof CreditsChanged) return 'credits-changed'
  const parts: string[] = []
  let e: unknown = err
  for (let i = 0; e && i < 5; i++) {
    const obj = e as {
      message?: string
      code?: string
      constraint?: string
      cause?: unknown
      data?: { errors?: Array<{ message?: string; path?: string }> }
    }
    parts.push(String(obj.message ?? ''), String(obj.code ?? ''), String(obj.constraint ?? ''))
    // Payload turns a unique-index violation into a ValidationError whose
    // field errors say "Value must be unique" on the indexed columns.
    for (const fe of obj.data?.errors ?? []) {
      if (/unique/i.test(String(fe.message)) && /customer|session/.test(String(fe.path))) {
        parts.push('one_active_per_customer_session')
      }
    }
    e = obj.cause
  }
  const text = parts.join(' ')
  if (/fully booked/i.test(text)) return 'full'
  if (/already has a booking|23505|one_active_per_customer_session/i.test(text)) return 'duplicate'
  return 'failed'
}

/**
 * Create a customer's booking and charge its credit (if any) as one
 * transaction: either both happen or neither does. The Bookings hook takes
 * the session's seat lock inside this same transaction.
 */
export async function createBookingAtomically(
  payload: Payload,
  customer: Customer,
  input: CreateBookingInput,
): Promise<{ ok: true; booking: Booking } | { ok: false; error: BookingError }> {
  const req = await createLocalReq({ user: { ...customer, collection: 'customers' } }, payload)
  await initTransaction(req)
  try {
    const booking = await payload.create({
      collection: 'bookings',
      data: {
        session: input.sessionId,
        customer: customer.id,
        status: 'confirmed',
        source: 'web',
        paymentStatus: input.paymentStatus,
        amountCents: input.amountCents,
        usedMembership: input.charge ? Number(input.charge.membershipId) : undefined,
        creditsUsed: input.charge?.credits ?? 0,
      },
      req,
      // Customers have no API create access; this service is the one path,
      // and confirmBooking has already priced and checked the booking.
      overrideAccess: true,
    })
    if (input.charge && input.charge.credits > 0) {
      const spent = await spendCredits(req, input.charge.membershipId, input.charge.credits)
      if (!spent) throw new CreditsChanged('credit pack no longer has enough credits')
    }
    await commitTransaction(req)
    return { ok: true, booking }
  } catch (err) {
    await killTransaction(req)
    const error = classifyBookingError(err)
    if (error === 'failed') payload.logger.error({ msg: 'createBookingAtomically failed', err })
    return { ok: false, error }
  }
}

/**
 * Cancel a customer's own booking and refund its credit as one
 * transaction. The booking row is locked first, so a double click (or two
 * tabs) cannot refund twice. Cancelling an already-cancelled booking is a
 * no-op success. Only a confirmed booking for a class that has not started
 * can be cancelled: an attended or past booking stays as it is, otherwise
 * cancelling it after the class would refund every credit.
 */
export async function cancelBookingAtomically(
  payload: Payload,
  customer: Customer,
  bookingId: number,
): Promise<{ ok: true } | { ok: false; error: 'not-found' | 'not-cancellable' | 'failed' }> {
  const req = await createLocalReq({ user: { ...customer, collection: 'customers' } }, payload)
  await initTransaction(req)
  try {
    const locked = await lockBooking(req, bookingId)
    if (!locked || locked.customerId !== customer.id) {
      await killTransaction(req)
      return { ok: false, error: 'not-found' }
    }
    if (locked.status === 'cancelled') {
      await killTransaction(req)
      return { ok: true }
    }
    const original = await payload.findByID({
      collection: 'bookings',
      id: bookingId,
      depth: 1,
      overrideAccess: true,
      req,
    })
    const startsAt =
      typeof original.session === 'object' && original.session ? original.session.startsAt : null
    if (locked.status !== 'confirmed' || !startsAt || new Date(startsAt).getTime() <= Date.now()) {
      await killTransaction(req)
      return { ok: false, error: 'not-cancellable' }
    }
    const refund = Number(original.creditsUsed ?? 0)
    const membership = original.usedMembership
    // A refunded booking records creditsUsed 0 and 'refunded', so the same
    // credit can never come back twice, even if an admin re-confirms it.
    await payload.update({
      collection: 'bookings',
      id: bookingId,
      data:
        refund > 0 && membership
          ? { status: 'cancelled', creditsUsed: 0, paymentStatus: 'refunded' }
          : { status: 'cancelled' },
      req,
      overrideAccess: true,
    })
    if (refund > 0 && membership) {
      const packId = typeof membership === 'object' ? membership.id : membership
      await refundCredits(req, packId, refund, customer.id)
    }
    await commitTransaction(req)
    return { ok: true }
  } catch (err) {
    await killTransaction(req)
    payload.logger.error({ msg: 'cancelBookingAtomically failed', err })
    return { ok: false, error: 'failed' }
  }
}
