'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'

import { findBookingByCode } from '@/lib/checkIn'
import { toRegistration } from '@/lib/registration'
import { getStaffUser } from '@/lib/session'
import config from '@/payload.config'

type Result =
  | { ok: true; checkedInAt: string }
  | { ok: false; error: 'not-staff' | 'not-found' | 'not-your-class' | 'cancelled' | 'failed' }

/**
 * Mark the booking behind a scanned check-in code as attended. Allowed for
 * admins and for the teacher of that class. Idempotent: a second scan
 * returns the original check-in time.
 */
export async function checkInByCode(code: string): Promise<Result> {
  const staff = await getStaffUser()
  if (!staff) return { ok: false, error: 'not-staff' }
  const booking = await findBookingByCode(code)
  const reg = booking && toRegistration(booking)
  if (!booking || !reg) return { ok: false, error: 'not-found' }
  if (staff.collection === 'teachers' && String(reg.teacherId) !== staff.id) {
    return { ok: false, error: 'not-your-class' }
  }
  if (reg.status === 'cancelled') return { ok: false, error: 'cancelled' }
  if (reg.status === 'attended' && reg.checkedInAt) return { ok: true, checkedInAt: reg.checkedInAt }

  try {
    const payload = await getPayload({ config: await config })
    const checkedInAt = new Date().toISOString()
    await payload.update({
      collection: 'bookings',
      id: booking.id,
      data: { status: 'attended', checkedInAt },
      overrideAccess: true,
    })
    revalidatePath('/[locale]/checkin/[code]', 'page')
    return { ok: true, checkedInAt }
  } catch {
    return { ok: false, error: 'failed' }
  }
}
