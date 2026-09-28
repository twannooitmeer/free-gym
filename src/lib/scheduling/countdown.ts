/**
 * Timing for the "your class is coming up" banner. No Node or framework
 * imports: client components use this directly.
 */

/** How long before a class the upcoming-class banner appears. */
export const BANNER_LEAD_MS = 24 * 60 * 60 * 1000

export function sessionEnd(startsAt: Date, durationMinutes: number | null | undefined): Date {
  return new Date(startsAt.getTime() + Math.max(0, Number(durationMinutes ?? 60)) * 60_000)
}

/** True from BANNER_LEAD_MS before the start until the class ends. */
export function inBannerWindow(startsAt: Date, endsAt: Date, now: Date): boolean {
  return now.getTime() >= startsAt.getTime() - BANNER_LEAD_MS && now.getTime() < endsAt.getTime()
}

export type Countdown =
  | { phase: 'upcoming'; days: number; hours: number; minutes: number; seconds: number }
  | { phase: 'live' }
  | { phase: 'over' }

/** Time left until a class, or whether it is running or over. */
export function countdown(startsAt: Date, endsAt: Date, now: Date): Countdown {
  const t = now.getTime()
  if (t >= endsAt.getTime()) return { phase: 'over' }
  if (t >= startsAt.getTime()) return { phase: 'live' }
  let s = Math.floor((startsAt.getTime() - t) / 1000)
  const days = Math.floor(s / 86_400)
  s -= days * 86_400
  const hours = Math.floor(s / 3600)
  s -= hours * 3600
  const minutes = Math.floor(s / 60)
  return { phase: 'upcoming', days, hours, minutes, seconds: s - minutes * 60 }
}
