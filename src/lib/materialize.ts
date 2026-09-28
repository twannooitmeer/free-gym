import type { Payload, PayloadRequest } from 'payload'

import { computeOccurrences, idOf, type SeriesLike } from './scheduling'

/**
 * Materializer: turn a SessionSeries template into concrete Sessions rows
 * up to `horizonWeeks` ahead.
 *
 * Design notes:
 * - Idempotent: skips dates where a Session already exists for this
 *   series (`series == this AND startsAt == target`). Re-running is safe.
 * - Override-safe: rows with `seriesOverride: true` are never touched.
 *   They count as "already exists" for the purpose of skipping the date.
 * - Cancellation-safe: a row already marked `status: cancelled` also
 *   blocks regeneration on that date (admin cancelled it; don't resurrect).
 * - Skips dates listed in `series.skipDates` (holidays, gym closures).
 * - Stops at `series.endsOn` if set.
 * - Honors `series.interval` (every N weeks) measured from `startsOn`.
 *
 * The date arithmetic lives in ./scheduling/recurrence.ts; this file is
 * only the Payload side (read existing rows, create the missing ones).
 */

/**
 * Generate (or skip) Sessions for this series. Returns a summary count.
 *
 * Pass `req` when calling from a hook: the nested find/create then join the
 * hook's open transaction. Without it they run on a separate connection,
 * which cannot see an uncommitted series row (FK fails on create) and
 * deadlocks against the series UPDATE's row lock (hang on update). The cron
 * route runs outside any transaction and calls without `req`.
 */
export async function materializeSeries(
  payload: Payload,
  series: SeriesLike,
  req?: PayloadRequest,
): Promise<{ created: number; skipped: number }> {
  const typeId = idOf(series.type)
  const teacherId = idOf(series.teacher)
  if (typeId == null || teacherId == null) {
    return { created: 0, skipped: 0 }
  }

  const targets = computeOccurrences(series)
  if (targets.length === 0) return { created: 0, skipped: 0 }

  // Pull existing sessions for this series in one query (small N expected).
  const existing = await payload.find({
    collection: 'sessions',
    where: { series: { equals: series.id } },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const takenInstants = new Set(
    existing.docs
      .map((d) => (d.startsAt ? new Date(d.startsAt as string).toISOString() : null))
      .filter((v): v is string => !!v),
  )

  let created = 0
  let skipped = 0
  for (const iso of targets) {
    if (takenInstants.has(iso)) {
      skipped++
      continue
    }
    try {
      await payload.create({
        collection: 'sessions',
        data: {
          title: series.title ?? undefined,
          type: typeId as never,
          teacher: teacherId as never,
          startsAt: iso,
          durationMinutes: Number(series.durationMinutes ?? 60),
          capacity: Number(series.capacity ?? 16),
          location: series.location ?? undefined,
          description: series.description ?? undefined,
          status: 'scheduled',
          series: series.id as never,
          seriesOverride: false,
        },
        overrideAccess: true,
        req,
      })
      created++
    } catch (err) {
      payload.logger.error({ msg: 'materializeSeries: create failed', err, iso, seriesId: series.id })
    }
  }
  return { created, skipped }
}
