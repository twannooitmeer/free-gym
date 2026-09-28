/**
 * Idempotent seed script for local dev and demo deployments.
 *
 * Run with:
 *   pnpm seed
 *
 * Creates (or updates by unique key):
 *   - 1 admin, 1 teacher, 1 verified customer
 *   - A small catalog of SessionTypes (kickboxing, boxing, sparring, PT)
 *   - Two MembershipTypes (unlimited monthly, 10-strip card)
 *   - Two recurring SessionSeries that materialize ~8 weeks of demo
 *     classes via the afterChange hook on save
 *
 * Demo data only: the passwords below are public. The script refuses to
 * run with NODE_ENV=production.
 */

import { pathToFileURL } from 'node:url'

import { getPayload, type Payload } from 'payload'

import config from '../src/payload.config'

import { DEMO_CUSTOMER, DEMO_TEACHER, isDemoMode } from '../src/lib/demo'

/**
 * The admin's password is public for local development only. In demo mode
 * the site is public, so it must come from SEED_ADMIN_PASSWORD instead.
 */
function adminPassword(): string {
  if (!isDemoMode()) return 'demo-admin-pass'
  const pw = process.env.SEED_ADMIN_PASSWORD
  if (!pw || pw.length < 16) {
    throw new Error('seed: DEMO_MODE=1 needs SEED_ADMIN_PASSWORD (at least 16 characters)')
  }
  return pw
}

const ADMIN = { email: 'admin@example.test', name: 'Demo Admin' }
const TEACHER = { ...DEMO_TEACHER, bio: 'Head coach. Stand-up specialist.' }
const CUSTOMER = DEMO_CUSTOMER

const SESSION_TYPES = [
  { slug: 'kickboxing', name: 'Kickboxing', color: '#dc2626', priceCents: 1500, coveredByMembership: true },
  { slug: 'boxing', name: 'Boxing', color: '#f59e0b', priceCents: 1500, coveredByMembership: true },
  { slug: 'sparring', name: 'Sparring', color: '#3b82f6', priceCents: 1000, coveredByMembership: true },
  { slug: 'pt', name: 'Personal Training', color: '#10b981', priceCents: 5000, coveredByMembership: false },
]

const MEMBERSHIP_TYPES = [
  {
    slug: 'unlimited-monthly',
    name: 'Unlimited Monthly',
    billingModel: 'unlimited' as const,
    priceCents: 9500,
    coversAllTypes: true,
    validityDays: 31,
  },
  {
    slug: '10-strip-card',
    name: '10-strip Card',
    billingModel: 'credits' as const,
    priceCents: 12500,
    coversAllTypes: true,
    creditsIncluded: 10,
    validityDays: 180,
  },
]

async function findOne(payload: Payload, collection: string, where: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (payload as any).find({ collection, where, limit: 1, depth: 0, overrideAccess: true })
  return res.docs[0] ?? null
}

async function upsert(
  payload: Payload,
  collection: string,
  uniqueField: string,
  uniqueValue: string,
  data: Record<string, unknown>,
) {
  const existing = await findOne(payload, collection, { [uniqueField]: { equals: uniqueValue } })
  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await (payload as any).update({
      collection,
      id: existing.id,
      data,
      overrideAccess: true,
    })
    return { doc: updated, created: false }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = await (payload as any).create({
    collection,
    data: { ...data, [uniqueField]: uniqueValue },
    overrideAccess: true,
  })
  return { doc, created: true }
}

/**
 * Fill the database with the demo gym. Idempotent. Refuses on a production
 * install unless it is a demo (DEMO_MODE=1): the demo passwords are public.
 */
export async function seed(payload: Payload) {
  if (process.env.NODE_ENV === 'production' && !isDemoMode()) {
    throw new Error('seed: refusing to run with NODE_ENV=production (the demo passwords are public)')
  }
  console.log('seeding...')

  // ── Gym details (only while still on the fresh-install default) ──
  const settings = await payload.findGlobal({ slug: 'settings', depth: 0 })
  if (!settings.gym?.name || settings.gym.name === 'Your Gym') {
    await payload.updateGlobal({
      slug: 'settings',
      data: {
        gym: {
          name: 'Demo Gym',
          contactEmail: 'hello@example.test',
          address: 'Example Street 1\n1234 AB Example City',
          defaultLocation: 'Main hall',
        },
      },
    })
    console.log('  settings: gym details set to the demo profile')
  }

  // ── Identity ─────────────────────────────────────────────────────
  const admin = await upsert(payload, 'admins', 'email', ADMIN.email, {
    name: ADMIN.name,
    password: adminPassword(),
  })
  console.log(`  admin: ${ADMIN.email} (${admin.created ? 'created' : 'updated'})`)

  const teacher = await upsert(payload, 'teachers', 'email', TEACHER.email, {
    name: TEACHER.name,
    password: TEACHER.password,
    bio: TEACHER.bio,
    active: true,
  })
  console.log(`  teacher: ${TEACHER.email} (${teacher.created ? 'created' : 'updated'})`)

  const customer = await upsert(payload, 'customers', 'email', CUSTOMER.email, {
    name: CUSTOMER.name,
    password: CUSTOMER.password,
    membershipStatus: 'none',
    emailVerified: true,
    verificationCode: null,
    verificationExpiresAt: null,
    verificationAttempts: 0,
  })
  console.log(`  customer: ${CUSTOMER.email} (${customer.created ? 'created' : 'updated'})`)

  // ── Catalog ──────────────────────────────────────────────────────
  const typesBySlug: Record<string, { id: number | string }> = {}
  for (const t of SESSION_TYPES) {
    const r = await upsert(payload, 'session-types', 'slug', t.slug, {
      name: t.name,
      color: t.color,
      priceCents: t.priceCents,
      coveredByMembership: t.coveredByMembership,
    })
    typesBySlug[t.slug] = r.doc
    console.log(`  session-type: ${t.slug} (${r.created ? 'created' : 'updated'})`)
  }

  for (const m of MEMBERSHIP_TYPES) {
    const r = await upsert(payload, 'membership-types', 'slug', m.slug, m)
    console.log(`  membership-type: ${m.slug} (${r.created ? 'created' : 'updated'})`)
  }

  // ── Recurring series (materializer runs on save) ─────────────────
  // Start "next Monday" so the demo has a fresh week ahead even after
  // multiple re-runs.
  const today = new Date()
  const dayIdx = today.getDay() // 0 = Sun
  const daysToMonday = ((1 - dayIdx + 7) % 7) || 7
  const nextMonday = new Date(today)
  nextMonday.setHours(0, 0, 0, 0)
  nextMonday.setDate(today.getDate() + daysToMonday - 7) // last Monday so this week's classes also exist

  const series = [
    {
      name: 'Mon/Wed Kickboxing 18:00',
      typeSlug: 'kickboxing',
      startTime: '18:00',
      durationMinutes: 60,
      capacity: 16,
      daysOfWeek: ['mon', 'wed'],
    },
    {
      name: 'Tue/Thu Boxing 19:00',
      typeSlug: 'boxing',
      startTime: '19:00',
      durationMinutes: 60,
      capacity: 14,
      daysOfWeek: ['tue', 'thu'],
    },
    {
      name: 'Fri Morning Kickboxing 07:00',
      typeSlug: 'kickboxing',
      startTime: '07:00',
      durationMinutes: 60,
      capacity: 16,
      daysOfWeek: ['fri'],
    },
    {
      name: 'Sun Personal Training 10:00',
      typeSlug: 'pt',
      startTime: '10:00',
      durationMinutes: 60,
      capacity: 1,
      daysOfWeek: ['sun'],
    },
    {
      name: 'Sat Sparring 11:00',
      typeSlug: 'sparring',
      startTime: '11:00',
      durationMinutes: 90,
      capacity: 12,
      daysOfWeek: ['sat'],
    },
  ]

  for (const s of series) {
    const type = typesBySlug[s.typeSlug]
    if (!type) continue
    const r = await upsert(payload, 'session-series', 'name', s.name, {
      active: true,
      type: type.id,
      teacher: teacher.doc.id,
      startTime: s.startTime,
      durationMinutes: s.durationMinutes,
      capacity: s.capacity,
      frequency: 'weekly',
      daysOfWeek: s.daysOfWeek,
      interval: 1,
      startsOn: nextMonday.toISOString(),
      horizonWeeks: 8,
    })
    console.log(`  session-series: ${s.name} (${r.created ? 'created' : 'updated'})`)
  }

  // ── The demo member holds a 10-class card, so booking with a credit
  //    (and getting it back on cancel) can be tried right away. ─────
  const card = await findOne(payload, 'membership-types', { slug: { equals: '10-strip-card' } })
  const hasCard = await findOne(payload, 'memberships', {
    and: [{ customer: { equals: customer.doc.id } }, { type: { equals: card?.id } }],
  })
  if (card && !hasCard) {
    await payload.create({
      collection: 'memberships',
      data: {
        customer: customer.doc.id,
        type: card.id,
        status: 'active',
        startsAt: new Date().toISOString(),
      },
      overrideAccess: true,
    })
    console.log('  membership: 10-strip card for the demo member')
  }

  console.log('done.')
  console.log('')
  console.log('Login:')
  console.log(`  admin:    ${ADMIN.email} / ${isDemoMode() ? '(SEED_ADMIN_PASSWORD)' : adminPassword()}  (Payload admin)`)
  console.log(`  teacher:  ${TEACHER.email} / ${TEACHER.password}  (/login)`)
  console.log(`  customer: ${CUSTOMER.email} / ${CUSTOMER.password}  (/login)`)
}

const runDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (runDirectly) {
  getPayload({ config: await config })
    .then((payload) => seed(payload))
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
