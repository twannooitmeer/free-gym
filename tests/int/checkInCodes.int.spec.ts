// @vitest-environment node
import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { createBookingAtomically } from '@/lib/booking'
import { findBookingByCode } from '@/lib/checkIn'
import type { Customer, Teacher } from '@/payload-types'
import config from '@/payload.config'

/**
 * A check-in code is what gets someone in the door, so: every booking has
 * one, nobody chooses it, and only its owner and admins can read it.
 */
describe('booking check-in codes', () => {
  let payload: Payload
  const tag = `ci-${Date.now()}`
  let owner: Customer
  let other: Customer
  let teacher: Teacher
  let sessionId: number

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const typeId = (
      await payload.create({
        collection: 'session-types',
        data: { name: `Type ${tag}`, slug: tag, priceCents: 0 },
        overrideAccess: true,
      })
    ).id
    teacher = await payload.create({
      collection: 'teachers',
      data: { name: 'T', email: `t-${tag}@example.test`, password: `pw-${tag}` },
      overrideAccess: true,
    })
    const mk = (n: string) =>
      payload.create({
        collection: 'customers',
        data: { name: n, email: `${n}-${tag}@example.test`, password: `pw-${tag}` },
        overrideAccess: true,
      })
    owner = await mk('owner')
    other = await mk('other')
    sessionId = (
      await payload.create({
        collection: 'sessions',
        data: {
          type: typeId,
          teacher: teacher.id,
          startsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
          durationMinutes: 60,
          capacity: 10,
          status: 'scheduled',
        },
        overrideAccess: true,
      })
    ).id
  })

  it('every booking gets its own code, and a code finds its booking', async () => {
    const a = await createBookingAtomically(payload, owner, { sessionId, paymentStatus: 'free', amountCents: 0 })
    const b = await createBookingAtomically(payload, other, { sessionId, paymentStatus: 'free', amountCents: 0 })
    expect(a.ok && b.ok).toBe(true)
    const codeA = a.ok ? a.booking.checkInCode : null
    const codeB = b.ok ? b.booking.checkInCode : null
    expect(codeA).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(codeB).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(codeA).not.toBe(codeB)
    expect((await findBookingByCode(codeA!))?.id).toBe(a.ok ? a.booking.id : -1)
    expect(await findBookingByCode('A'.repeat(22))).toBeNull()
  })

  it('nobody chooses a code: customers cannot create bookings over the API, and admins cannot set one', async () => {
    const data = {
      session: sessionId,
      customer: owner.id,
      status: 'confirmed' as const,
      source: 'web' as const,
      paymentStatus: 'free' as const,
      checkInCode: 'chosen-by-the-customer',
    }
    await expect(
      payload.create({
        collection: 'bookings',
        data,
        user: { ...owner, collection: 'customers' as const },
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    const admin = await payload.create({
      collection: 'admins',
      data: { name: 'A', email: `a-${tag}@example.test`, password: `pw-${tag}` },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'bookings',
      where: { customer: { equals: owner.id } },
      data: { status: 'cancelled' },
      overrideAccess: true,
    })
    const created = await payload.create({
      collection: 'bookings',
      data,
      user: { ...admin, collection: 'admins' as const },
      overrideAccess: false,
    })
    expect(created.checkInCode).not.toBe('chosen-by-the-customer')
    expect(created.checkInCode).toMatch(/^[A-Za-z0-9_-]{22}$/)
  })

  it('only the owner (and admins) can read a code', async () => {
    const mine = await payload.find({
      collection: 'bookings',
      where: { customer: { equals: owner.id } },
      user: { ...owner, collection: 'customers' },
      overrideAccess: false,
    })
    expect(mine.docs.length).toBeGreaterThan(0)
    expect(mine.docs.every((d) => typeof d.checkInCode === 'string')).toBe(true)

    const roster = await payload.find({
      collection: 'bookings',
      where: { session: { equals: sessionId } },
      user: { ...teacher, collection: 'teachers' },
      overrideAccess: false,
    })
    expect(roster.docs.length).toBeGreaterThanOrEqual(2)
    expect(roster.docs.every((d) => d.checkInCode === undefined)).toBe(true)
  })
})
