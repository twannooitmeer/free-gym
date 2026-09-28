/**
 * Recurrence: turn a weekly series rule into concrete start instants.
 *
 * Pure date arithmetic over plain data, no Payload and no database, so it
 * can be tested in isolation and lifted into a shared package later (see
 * index.ts for the boundary rule).
 *
 * Timezone: the user-facing time of day is the gym's wall clock. Instants
 * are built from local Y/M/D/H/M, which uses the SERVER time zone; the
 * compose file sets TZ on the container so server-local == gym-local.
 */

const DOW_TO_INDEX: Record<string, number> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 0,
}

export type SeriesLike = {
  id: number | string
  active?: boolean | null
  type?: number | string | { id: number | string } | null
  teacher?: number | string | { id: number | string } | null
  title?: string | null
  startTime?: string | null
  durationMinutes?: number | null
  capacity?: number | null
  location?: string | null
  description?: string | null
  frequency?: string | null
  daysOfWeek?: string[] | null
  interval?: number | null
  startsOn?: string | null
  endsOn?: string | null
  skipDates?: Array<{ date?: string | null }> | null
  horizonWeeks?: number | null
}

export function idOf(v: SeriesLike['type']): number | string | null {
  if (v == null) return null
  if (typeof v === 'object') return v.id
  return v
}

/** YYYY-MM-DD in the SERVER's local timezone. */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Monday of the ISO week containing `d` (00:00 local). */
function mondayOf(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = out.getDay() // 0=Sun..6=Sat
  const diff = dow === 0 ? -6 : 1 - dow
  out.setDate(out.getDate() + diff)
  return out
}

/** Whole-week difference between two midnights, ignoring DST seams. */
function weeksBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime()
  return Math.round(ms / (7 * 86_400_000))
}

/**
 * Compute the list of UTC ISO timestamps that the series should produce
 * between `now` and `now + horizonWeeks`. Pure for testability.
 */
export function computeOccurrences(series: SeriesLike, now: Date = new Date()): string[] {
  if (!series.active) return []
  if (!series.daysOfWeek?.length) return []
  if (!series.startTime || !/^\d{2}:\d{2}$/.test(series.startTime)) return []

  const horizonWeeks = Math.max(1, Number(series.horizonWeeks ?? 8))
  const interval = Math.max(1, Number(series.interval ?? 1))

  const startsOn = series.startsOn ? new Date(series.startsOn) : now
  const endsOn = series.endsOn ? new Date(series.endsOn) : null
  const horizonEnd = new Date(now.getTime() + horizonWeeks * 7 * 86_400_000)

  const [hhStr, mmStr] = series.startTime.split(':')
  const hh = Number(hhStr)
  const mm = Number(mmStr)

  const skip = new Set(
    (series.skipDates ?? [])
      .map((s) => (s?.date ? ymd(new Date(s.date)) : null))
      .filter((v): v is string => !!v),
  )

  const weekDayIndices = series.daysOfWeek
    .map((d) => DOW_TO_INDEX[d])
    .filter((v) => v !== undefined)

  // Anchor for interval math: Monday of the week containing startsOn.
  const anchor = mondayOf(startsOn)

  // First materialization week = Monday of MAX(now, startsOn).
  const firstWeekStart = mondayOf(now.getTime() > startsOn.getTime() ? now : startsOn)

  const occurrences: string[] = []
  for (
    let weekStart = new Date(firstWeekStart);
    weekStart.getTime() <= horizonEnd.getTime();
    weekStart.setDate(weekStart.getDate() + 7)
  ) {
    const wkIndex = weeksBetween(anchor, weekStart)
    if (wkIndex < 0) continue
    if (wkIndex % interval !== 0) continue

    for (const dowIdx of weekDayIndices) {
      const day = new Date(weekStart)
      // weekStart is Monday (=1). Offset to the target day. Sunday=0 maps to +6.
      const offset = dowIdx === 0 ? 6 : dowIdx - 1
      day.setDate(day.getDate() + offset)
      day.setHours(hh, mm, 0, 0)

      if (day.getTime() < startsOn.getTime()) continue
      if (day.getTime() < now.getTime()) continue
      if (day.getTime() > horizonEnd.getTime()) continue
      if (endsOn && day.getTime() > endsOn.getTime()) continue
      if (skip.has(ymd(day))) continue

      occurrences.push(day.toISOString())
    }
  }
  return occurrences
}
