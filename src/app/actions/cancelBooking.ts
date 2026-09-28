'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'

import { getSession } from '@/lib/session'
import { cancelBookingAtomically } from '@/lib/booking'
import config from '@/payload.config'

type ActionResult = { ok: true } | { ok: false; error: string }

/**
 * Customer cancels one of their own bookings.
 *
 * We don't hard-delete: status flips to 'cancelled' so the gym keeps a
 * paper trail (and capacity recovers because the capacity check ignores
 * cancelled rows). The status change and any credit refund are one
 * transaction (lib/booking.ts).
 */
export async function cancelBooking(bookingId: string | number): Promise<ActionResult> {
  const session = await getSession()
  if (!session?.user) return { ok: false, error: 'not-authenticated' }
  if (session.user.role !== 'customers') return { ok: false, error: 'wrong-role' }

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  let customer
  try {
    customer = await payload.findByID({
      collection: 'customers',
      id: session.user.id,
      overrideAccess: true,
    })
  } catch {
    return { ok: false, error: 'customer-not-found' }
  }

  const result = await cancelBookingAtomically(payload, customer, Number(bookingId))
  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath('/[locale]/me', 'page')
  revalidatePath('/[locale]/schedule', 'page')
  return { ok: true }
}
