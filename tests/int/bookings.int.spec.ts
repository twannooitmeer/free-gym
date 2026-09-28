// @vitest-environment node
import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload, type Where } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { cancelBookingAtomically, createBookingAtomically } from '@/lib/booking'
import { consumeVerificationAttempt } from '@/lib/db'
import type { Customer } from '@/payload-types'
import config from '@/payload.config'

/**
 * The three booking invariants (lib/scheduling/bookings.ts), exercised the
 * way they break in real life: concurrent requests against a real Postgres
 * (DATABASE_URL). Each race fires the requests with Promise.all, so both
 * reach the database before either commits.
 */

describe('booking invariants under concurrency', () => {
  let payload: Payload
  const tag = `bk-${Date.now()}`
  let typeId: number
  let teacherId: number
  let alice: Customer
  let bob: Customer
  let creditPackId: number

  const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()

  async function newSession(capacity: number, days: number) {
    const s = await payload.create({
      collection: 'sessions',
      data: {
        type: typeId,
        teacher: teacherId,
        startsAt: future(days),
        durationMinutes: 60,
        capacity,
        status: 'scheduled',
      },
      overrideAccess: true,
    })
    return s.id
  }

  async function newCustomer(name: string) {
    return payload.create({
      collection: 'customers',
      data: { name, email: `${name}-${tag}@example.test`, password: `pw-${tag}` },
      overrideAccess: true,
    })
  }

  const activeBookings = async (where: Where) =>
    (
      await payload.count({
        collection: 'bookings',
        where: { and: [where, { status: { not_equals: 'cancelled' } }] },
        overrideAccess: true,
      })
    ).totalDocs

  const creditsLeft = async () =>
    Number(
      (await payload.findByID({ collection: 'memberships', id: creditPackId, overrideAccess: true }))
        .creditsRemaining,
    )

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    typeId = (
      await payload.create({
        collection: 'session-types',
        data: { name: `Type ${tag}`, slug: tag, priceCents: 1500 },
        overrideAccess: true,
      })
    ).id
    teacherId = (
      await payload.create({
        collection: 'teachers',
        data: { name: 'Teacher', email: `t-${tag}@example.test`, password: `pw-${tag}` },
        overrideAccess: true,
      })
    ).id
    alice = await newCustomer('alice')
    bob = await newCustomer('bob')
    const packType = await payload.create({
      collection: 'membership-types',
      data: {
        name: `Pack ${tag}`,
        slug: `pack-${tag}`,
        billingModel: 'credits',
        priceCents: 5000,
        creditsIncluded: 1,
        coversAllTypes: true,
      },
      overrideAccess: true,
    })
    creditPackId = (
      await payload.create({
        collection: 'memberships',
        data: {
          customer: alice.id,
          type: packType.id,
          status: 'active',
          startsAt: new Date().toISOString(),
        },
        overrideAccess: true,
      })
    ).id
  })


  it('two customers racing for the last seat: exactly one gets it', async () => {
    const sessionId = await newSession(1, 3)
    const results = await Promise.all(
      [alice, bob].map((c) =>
        createBookingAtomically(payload, c, { sessionId, paymentStatus: 'unpaid', amountCents: 1500 }),
      ),
    )
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    expect(results.filter((r) => !r.ok).map((r) => !r.ok && r.error)).toEqual(['full'])
    expect(await activeBookings({ session: { equals: sessionId } })).toBe(1)
  })

  it('one customer double-submitting: exactly one booking', async () => {
    const sessionId = await newSession(10, 4)
    const results = await Promise.all(
      [1, 2, 3].map(() =>
        createBookingAtomically(payload, bob, { sessionId, paymentStatus: 'unpaid', amountCents: 1500 }),
      ),
    )
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    expect(new Set(results.filter((r) => !r.ok).map((r) => !r.ok && r.error))).toEqual(
      new Set(['duplicate']),
    )
    expect(await activeBookings({ session: { equals: sessionId }, customer: { equals: bob.id } })).toBe(1)
  })

  it('the unique index holds even for writes that skip every hook', async () => {
    const sessionId = await newSession(10, 5)
    const insert = (status: string) =>
      payload.db.drizzle.execute(sql`
        insert into bookings (customer_id, session_id, status, source, payment_status, updated_at, created_at)
        values (${alice.id}, ${sessionId}, ${status}, 'manual', 'free', now(), now())`)
    await insert('confirmed')
    await expect(insert('confirmed')).rejects.toThrow()
    // A cancelled row is history, not a held seat, so it may coexist.
    await expect(insert('cancelled')).resolves.toBeDefined()
  })

  it('two bookings racing for the last credit: one is charged, the other writes nothing', async () => {
    expect(await creditsLeft()).toBe(1)
    const [s1, s2] = [await newSession(10, 6), await newSession(10, 7)]
    const results = await Promise.all(
      [s1, s2].map((sessionId) =>
        createBookingAtomically(payload, alice, {
          sessionId,
          paymentStatus: 'credit',
          amountCents: 0,
          charge: { membershipId: creditPackId, credits: 1 },
        }),
      ),
    )
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    expect(results.filter((r) => !r.ok).map((r) => !r.ok && r.error)).toEqual(['credits-changed'])
    expect(await creditsLeft()).toBe(0)
    // The losing booking was rolled back together with its failed charge.
    expect(await activeBookings({ session: { in: [s1, s2] }, customer: { equals: alice.id } })).toBe(1)
  })

  it('cancelling twice at once refunds the credit once', async () => {
    const booking = await payload.find({
      collection: 'bookings',
      where: { and: [{ customer: { equals: alice.id } }, { paymentStatus: { equals: 'credit' } }] },
      overrideAccess: true,
    })
    const id = booking.docs[0].id
    const results = await Promise.all([1, 2].map(() => cancelBookingAtomically(payload, alice, id)))
    expect(results.every((r) => r.ok)).toBe(true)
    expect(await creditsLeft()).toBe(1)
  })

  it('a customer cannot cancel someone else’s booking', async () => {
    const sessionId = await newSession(10, 8)
    const created = await createBookingAtomically(payload, bob, {
      sessionId,
      paymentStatus: 'unpaid',
      amountCents: 1500,
    })
    expect(created.ok).toBe(true)
    const id = created.ok ? created.booking.id : 0
    expect(await cancelBookingAtomically(payload, alice, id)).toEqual({ ok: false, error: 'not-found' })
    expect(await activeBookings({ id: { equals: id } })).toBe(1)
  })
})

describe('refunds and verification attempts', () => {
  let payload: Payload
  const tag = `rf-${Date.now()}`

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  async function setup() {
    const type = await payload.create({
      collection: 'session-types',
      data: { name: `T ${tag}`, slug: `${tag}-${Math.random()}`, priceCents: 1500 },
      overrideAccess: true,
    })
    const teacher = await payload.create({
      collection: 'teachers',
      data: { name: 'T', email: `t-${Math.random()}@example.test`, password: 'pw-12345678' },
      overrideAccess: true,
    })
    const session = await payload.create({
      collection: 'sessions',
      data: {
        type: type.id,
        teacher: teacher.id,
        startsAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
        durationMinutes: 60,
        capacity: 10,
        status: 'scheduled',
      },
      overrideAccess: true,
    })
    const mk = async (n: string) => {
      const c = await payload.create({
        collection: 'customers',
        data: { name: n, email: `${n}-${Math.random()}@example.test`, password: 'pw-12345678' },
        overrideAccess: true,
      })
      const packType = await payload.create({
        collection: 'membership-types',
        data: { name: `P ${n}`, slug: `p-${Math.random()}`, billingModel: 'credits', priceCents: 1, creditsIncluded: 5, coversAllTypes: true },
        overrideAccess: true,
      })
      const pack = await payload.create({
        collection: 'memberships',
        data: { customer: c.id, type: packType.id, status: 'active', startsAt: new Date().toISOString() },
        overrideAccess: true,
      })
      return { c, pack }
    }
    return { sessionId: session.id, ...(await mk('ann')), other: await mk('ben') }
  }

  const credits = async (id: number) =>
    Number((await payload.findByID({ collection: 'memberships', id, overrideAccess: true })).creditsRemaining)

  it('a refunded booking cannot be refunded again, even after an admin re-confirms it', async () => {
    const { sessionId, c, pack } = await setup()
    const made = await createBookingAtomically(payload, c, {
      sessionId,
      paymentStatus: 'credit',
      amountCents: 0,
      charge: { membershipId: pack.id, credits: 1 },
    })
    expect(made.ok).toBe(true)
    const id = made.ok ? made.booking.id : 0
    expect(await credits(pack.id)).toBe(4)
    await cancelBookingAtomically(payload, c, id)
    expect(await credits(pack.id)).toBe(5)
    const b = await payload.findByID({ collection: 'bookings', id, overrideAccess: true })
    expect(b.creditsUsed).toBe(0)
    expect(b.paymentStatus).toBe('refunded')
    await payload.update({ collection: 'bookings', id, data: { status: 'confirmed' }, overrideAccess: true })
    await cancelBookingAtomically(payload, c, id)
    expect(await credits(pack.id)).toBe(5)
  })

  it("a refund never lands on another member's pack", async () => {
    const { sessionId, c, other } = await setup()
    const b = await payload.create({
      collection: 'bookings',
      data: {
        session: sessionId,
        customer: c.id,
        status: 'confirmed',
        source: 'manual',
        paymentStatus: 'credit',
        usedMembership: other.pack.id,
        creditsUsed: 3,
      },
      overrideAccess: true,
    })
    await cancelBookingAtomically(payload, c, b.id)
    expect(await credits(other.pack.id)).toBe(5)
  })

  it('twenty parallel verification guesses get exactly five attempts', async () => {
    const { c } = await setup()
    const results = await Promise.all(
      Array.from({ length: 20 }, () => consumeVerificationAttempt(payload, c.id, 5)),
    )
    expect(results.filter(Boolean)).toHaveLength(5)
  })
})

describe('what can still be cancelled', () => {
  let payload: Payload
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  async function bookingWithCredit(startsInMs: number, status: 'confirmed' | 'attended') {
    const r = Math.random().toString(36).slice(2)
    const type = await payload.create({ collection: 'session-types', data: { name: `T${r}`, slug: `c-${r}`, priceCents: 1500 }, overrideAccess: true })
    const teacher = await payload.create({ collection: 'teachers', data: { name: 'T', email: `t-${r}@example.test`, password: 'pw-12345678' }, overrideAccess: true })
    const session = await payload.create({
      collection: 'sessions',
      data: { type: type.id, teacher: teacher.id, startsAt: new Date(Date.now() + startsInMs).toISOString(), durationMinutes: 60, capacity: 10, status: 'scheduled' },
      overrideAccess: true,
    })
    const customer = await payload.create({ collection: 'customers', data: { name: 'c', email: `c-${r}@example.test`, password: 'pw-12345678' }, overrideAccess: true })
    const packType = await payload.create({
      collection: 'membership-types',
      data: { name: `P${r}`, slug: `p-${r}`, billingModel: 'credits', priceCents: 1, creditsIncluded: 3, coversAllTypes: true },
      overrideAccess: true,
    })
    const pack = await payload.create({ collection: 'memberships', data: { customer: customer.id, type: packType.id, status: 'active', startsAt: new Date().toISOString() }, overrideAccess: true })
    const booking = await payload.create({
      collection: 'bookings',
      data: { session: session.id, customer: customer.id, status, source: 'web', paymentStatus: 'credit', usedMembership: pack.id, creditsUsed: 1 },
      overrideAccess: true,
    })
    return { customer, booking, packId: pack.id }
  }

  const left = async (id: number) =>
    Number((await payload.findByID({ collection: 'memberships', id, overrideAccess: true })).creditsRemaining)

  it('an attended booking cannot be cancelled for a refund', async () => {
    const { customer, booking, packId } = await bookingWithCredit(-30 * 60_000, 'attended')
    expect(await cancelBookingAtomically(payload, customer, booking.id)).toEqual({ ok: false, error: 'not-cancellable' })
    expect(await left(packId)).toBe(3)
  })

  it('a class that has started cannot be cancelled, one that has not can', async () => {
    const past = await bookingWithCredit(-5 * 60_000, 'confirmed')
    expect(await cancelBookingAtomically(payload, past.customer, past.booking.id)).toEqual({ ok: false, error: 'not-cancellable' })
    const future = await bookingWithCredit(2 * 3600_000, 'confirmed')
    expect(await cancelBookingAtomically(payload, future.customer, future.booking.id)).toEqual({ ok: true })
    expect(await left(future.packId)).toBe(4)
  })
})
