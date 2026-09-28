import { getPayload } from 'payload'

import type { Booking, Session as GymSession } from '@/payload-types'
import config from '@/payload.config'

import { BANNER_LEAD_MS, inBannerWindow, sessionEnd } from './scheduling'

/** What the registration page, the banner and the check-in page show about a booking. */
export type Registration = {
  id: number
  status: Booking['status']
  code: string | null
  checkedInAt: string | null
  customerId: number
  customerName: string | null
  title: string
  typeColor: string | null
  teacherId: number | null
  teacherName: string | null
  location: string | null
  startsAt: Date
  endsAt: Date
  paymentStatus: Booking['paymentStatus']
  amountCents: number
}

const idOf = (v: unknown): number | null =>
  v == null ? null : typeof v === 'object' ? Number((v as { id: unknown }).id) : Number(v)

/** Flatten a booking loaded at depth 2 (session -> type, teacher; customer). */
export function toRegistration(b: Booking): Registration | null {
  const s = typeof b.session === 'object' && b.session ? (b.session as GymSession) : null
  if (!s) return null
  const type = typeof s.type === 'object' && s.type ? s.type : null
  const teacher = typeof s.teacher === 'object' && s.teacher ? s.teacher : null
  const customer = typeof b.customer === 'object' && b.customer ? b.customer : null
  const startsAt = new Date(s.startsAt)
  return {
    id: b.id,
    status: b.status,
    code: b.checkInCode ?? null,
    checkedInAt: b.checkedInAt ?? null,
    customerId: idOf(b.customer) ?? 0,
    customerName: customer?.name ?? null,
    title: s.title || type?.name || '',
    typeColor: type?.color ?? null,
    teacherId: idOf(s.teacher),
    teacherName: teacher?.name ?? null,
    location: s.location ?? null,
    startsAt,
    endsAt: sessionEnd(startsAt, s.durationMinutes),
    paymentStatus: b.paymentStatus,
    amountCents: Number(b.amountCents ?? 0),
  }
}

/** One of the customer's own bookings, or null if it is not theirs. */
export async function loadOwnRegistration(
  customerId: string | number,
  bookingId: string | number,
  locale: string,
): Promise<Registration | null> {
  const id = Number(bookingId)
  if (!Number.isInteger(id)) return null
  const payload = await getPayload({ config: await config })
  const b = await payload
    .findByID({
      collection: 'bookings',
      id,
      depth: 2,
      overrideAccess: true,
      locale: locale === 'en' ? 'en' : 'nl',
    })
    .catch(() => null)
  if (!b || String(idOf(b.customer)) !== String(customerId)) return null
  return toRegistration(b)
}

/**
 * The customer's next confirmed booking whose class starts within
 * BANNER_LEAD_MS or is running now, for the site-wide banner.
 */
export async function nextUpcomingRegistration(
  customerId: string | number,
  locale: string,
  now: Date,
): Promise<Registration | null> {
  const payload = await getPayload({ config: await config })
  const res = await payload.find({
    collection: 'bookings',
    where: {
      and: [
        { customer: { equals: customerId } },
        { status: { equals: 'confirmed' } },
        // Classes last hours at most, so this bounds the candidates; the
        // exact window (start - 24h until the end) is applied below.
        { 'session.startsAt': { greater_than: new Date(now.getTime() - 12 * 3600_000).toISOString() } },
        { 'session.startsAt': { less_than: new Date(now.getTime() + BANNER_LEAD_MS).toISOString() } },
      ],
    },
    depth: 2,
    limit: 20,
    overrideAccess: true,
    locale: locale === 'en' ? 'en' : 'nl',
  })
  return (
    res.docs
      .map(toRegistration)
      .filter((r): r is Registration => r !== null && r.status !== 'cancelled')
      .filter((r) => inBannerWindow(r.startsAt, r.endsAt, now))
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0] ?? null
  )
}
