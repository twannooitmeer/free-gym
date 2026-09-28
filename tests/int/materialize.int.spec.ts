// @vitest-environment node
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { computeOccurrences } from '@/lib/scheduling'
import config from '@/payload.config'

/**
 * The SessionSeries afterChange hook materializes sessions inside the
 * series' own transaction. These tests hit a real Postgres (DATABASE_URL)
 * and guard two failure modes of running the nested writes outside it:
 * - create: the session FK to the uncommitted series row fails, 0 sessions
 * - update: the session insert waits on the series row lock, which the
 *   hook holds until the insert returns, so the save hangs forever
 */

const HANG_TIMEOUT_MS = 15_000

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} did not finish in ${HANG_TIMEOUT_MS} ms`)),
      HANG_TIMEOUT_MS,
    )
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

async function sessionsFor(payload: Payload, seriesId: number | string) {
  const res = await payload.find({
    collection: 'sessions',
    where: { series: { equals: seriesId } },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  return res.docs
}

describe('SessionSeries materializer hook', () => {
  let payload: Payload
  const tag = `int-${Date.now()}`
  let typeId: number
  let teacherId: number
  let seriesId: number | undefined

  // Tomorrow at local midnight, so every occurrence is safely in the future.
  const startsOn = new Date()
  startsOn.setHours(0, 0, 0, 0)
  startsOn.setDate(startsOn.getDate() + 1)

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const type = await payload.create({
      collection: 'session-types',
      data: { name: `Type ${tag}`, slug: tag, priceCents: 1000 },
      overrideAccess: true,
    })
    typeId = type.id
    const teacher = await payload.create({
      collection: 'teachers',
      data: { name: `Teacher ${tag}`, email: `${tag}@example.test`, password: `pw-${tag}` },
      overrideAccess: true,
    })
    teacherId = teacher.id
  }, 60_000)

  afterAll(async () => {
    if (!payload) return
    if (seriesId != null) {
      await payload.delete({
        collection: 'sessions',
        where: { series: { equals: seriesId } },
        overrideAccess: true,
      })
      await payload.delete({ collection: 'session-series', id: seriesId, overrideAccess: true })
    }
    if (teacherId != null)
      await payload.delete({ collection: 'teachers', id: teacherId, overrideAccess: true })
    if (typeId != null)
      await payload.delete({ collection: 'session-types', id: typeId, overrideAccess: true })
    await payload.destroy()
  }, 30_000)

  it('creates sessions when a series is created', async () => {
    const series = await withTimeout(
      payload.create({
        collection: 'session-series',
        data: {
          name: `Series ${tag}`,
          active: true,
          type: typeId,
          teacher: teacherId,
          startTime: '18:00',
          durationMinutes: 60,
          capacity: 12,
          frequency: 'weekly',
          daysOfWeek: ['mon', 'wed'],
          interval: 1,
          startsOn: startsOn.toISOString(),
          horizonWeeks: 2,
        },
        overrideAccess: true,
      }),
      'series create',
    )
    seriesId = series.id

    const expected = computeOccurrences(series)
    expect(expected.length).toBeGreaterThan(0)

    const sessions = await sessionsFor(payload, series.id)
    expect(sessions).toHaveLength(expected.length)
    expect(sessions.map((s) => new Date(s.startsAt).toISOString()).sort()).toEqual(
      [...expected].sort(),
    )
  }, 30_000)

  it('updates a series without hanging and materializes the new days', async () => {
    expect(seriesId).toBeDefined()

    const updated = await withTimeout(
      payload.update({
        collection: 'session-series',
        id: seriesId!,
        data: { daysOfWeek: ['mon', 'wed', 'fri'] },
        overrideAccess: true,
      }),
      'series update',
    )

    const expected = computeOccurrences(updated)
    const sessions = await sessionsFor(payload, seriesId!)
    expect(sessions).toHaveLength(expected.length)
  }, 30_000)
})
