import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Creates the data the e2e tests need, through Payload itself, in the
 * same database the test server uses: a teacher, a free class starting in
 * three hours (so the upcoming-class banner shows), and one booking whose
 * check-in code the staff test scans. Writes their ids to .state.json.
 */
export default async function globalSetup() {
  if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  const { getPayload } = await import('payload')
  const { default: config } = await import('../../src/payload.config')
  const payload = await getPayload({ config: await config })

  const tag = `e2e${Date.now()}`
  const password = `pw-${tag}`
  const type = await payload.create({
    collection: 'session-types',
    data: { name: 'E2E Boxing', slug: tag, priceCents: 0 },
    overrideAccess: true,
  })
  const teacher = await payload.create({
    collection: 'teachers',
    data: { name: 'E2E Coach', email: `coach-${tag}@example.test`, password },
    overrideAccess: true,
  })
  const title = `E2E class ${tag}`
  const session = await payload.create({
    collection: 'sessions',
    data: {
      title,
      type: type.id,
      teacher: teacher.id,
      startsAt: new Date(Date.now() + 3 * 3600_000).toISOString(),
      durationMinutes: 60,
      capacity: 5,
      status: 'scheduled',
    },
    overrideAccess: true,
  })
  const member = await payload.create({
    collection: 'customers',
    data: { name: `Member ${tag}`, email: `member-${tag}@example.test`, password, emailVerified: true },
    overrideAccess: true,
  })
  const booking = await payload.create({
    collection: 'bookings',
    data: { session: session.id, customer: member.id, status: 'confirmed', source: 'manual', paymentStatus: 'free' },
    overrideAccess: true,
  })

  writeFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '.state.json'),
    JSON.stringify({
      tag,
      password,
      sessionId: session.id,
      title,
      teacherEmail: teacher.email,
      memberName: member.name,
      checkInCode: booking.checkInCode,
    }),
  )
  await payload.destroy()
}
