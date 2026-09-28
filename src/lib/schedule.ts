/**
 * Schedule / week-grid helpers.
 *
 * Notes
 * -----
 * - The gym lives in Europe/Amsterdam. The container is configured with
 *   `TZ=Europe/Amsterdam` (see docker-compose), so `new Date()` arithmetic
 *   below is local-time correct on the server. For local dev on a Dutch
 *   workstation the same is true. If we ever deploy outside CET we'll need
 *   to switch to `date-fns-tz`.
 *
 * - ISO week: Monday is day 0 for our purposes. We never use Sunday-first.
 *
 * - We store and compare week starts as `YYYY-MM-DD` strings so they round-trip
 *   safely through query strings.
 */

export const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Default visible range when the gym hasn't configured Opening Hours yet.
 * The grid always renders 1 px per minute.
 */
export const DEFAULT_GRID_START_HOUR = 6
export const DEFAULT_GRID_END_HOUR = 23
export const GRID_PX_PER_MIN = 1

/** Parse `HH:mm` → minutes-since-midnight. Returns null on bad input. */
export function parseHHmm(value: string | null | undefined): number | null {
  if (!value) return null
  const m = /^([0-2]?\d):([0-5]\d)$/.exec(value.trim())
  if (!m) return null
  const h = Number(m[1])
  const mm = Number(m[2])
  if (h > 24 || (h === 24 && mm !== 0)) return null
  return h * 60 + mm
}

export type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export type OpeningHour = {
  day: WeekdayKey
  closed?: boolean | null
  open?: string | null
  close?: string | null
}

/** JS Date.getDay() to our weekday key. */
export function weekdayKeyFromDate(d: Date): WeekdayKey {
  // getDay(): 0 = Sun, 1 = Mon, ... 6 = Sat
  return (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[d.getDay()]
}

/**
 * Collapse per-day opening hours into a single contiguous grid range that
 * covers every open day. Rounds outward to whole hours so half-past start
 * times still fit on the rail. Falls back to defaults when no hours are set
 * or every day is closed.
 */
export function gridRangeFromHours(hours: OpeningHour[] | null | undefined): {
  startHour: number
  endHour: number
} {
  const openMinutes: number[] = []
  const closeMinutes: number[] = []
  for (const h of hours ?? []) {
    if (h.closed) continue
    const o = parseHHmm(h.open)
    const c = parseHHmm(h.close)
    if (o == null || c == null || c <= o) continue
    openMinutes.push(o)
    closeMinutes.push(c)
  }
  if (openMinutes.length === 0 || closeMinutes.length === 0) {
    return { startHour: DEFAULT_GRID_START_HOUR, endHour: DEFAULT_GRID_END_HOUR }
  }
  const startHour = Math.max(0, Math.floor(Math.min(...openMinutes) / 60))
  const endHour = Math.min(24, Math.ceil(Math.max(...closeMinutes) / 60))
  return { startHour, endHour }
}

/** Map weekday key → opening row (or null when closed/missing). */
export function buildOpeningMap(
  hours: OpeningHour[] | null | undefined,
): Record<WeekdayKey, { openMin: number; closeMin: number } | null> {
  const out: Record<WeekdayKey, { openMin: number; closeMin: number } | null> = {
    mon: null,
    tue: null,
    wed: null,
    thu: null,
    fri: null,
    sat: null,
    sun: null,
  }
  for (const h of hours ?? []) {
    if (h.closed) continue
    const o = parseHHmm(h.open)
    const c = parseHHmm(h.close)
    if (o == null || c == null || c <= o) continue
    out[h.day] = { openMin: o, closeMin: c }
  }
  return out
}

/** Convert a `YYYY-MM-DD` to a Date at local midnight. */
export function ymdToDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

/** Format a Date as `YYYY-MM-DD` in local time. */
export function dateToYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Monday of the week that contains `d` (local time). */
export function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
  // getDay(): 0 = Sun, 1 = Mon, ... 6 = Sat. We want Mon as anchor.
  const dow = out.getDay()
  const deltaToMonday = dow === 0 ? -6 : 1 - dow
  out.setDate(out.getDate() + deltaToMonday)
  return out
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

/** Inclusive→exclusive UTC bounds for the given local week. */
export function weekRange(weekStart: Date): { from: Date; to: Date } {
  return { from: weekStart, to: addDays(weekStart, 7) }
}

/** Pixel offset from the top of the day column for a given Date. */
export function minutesFromGridStart(d: Date, gridStartHour: number): number {
  const minutesIntoDay = d.getHours() * 60 + d.getMinutes()
  return minutesIntoDay - gridStartHour * 60
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Locale-aware HH:mm formatter (24h, NL/EN both use 24h here). */
export function formatTime(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

export function formatDayHeader(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d)
}

export function formatWeekRange(start: Date, locale: string): string {
  const end = addDays(start, 6)
  const fmt = new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', {
    day: 'numeric',
    month: 'short',
  })
  const yearFmt = new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', {
    year: 'numeric',
  })
  return `${fmt.format(start)} – ${fmt.format(end)} ${yearFmt.format(end)}`
}
