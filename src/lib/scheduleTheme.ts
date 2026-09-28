/**
 * Resolves theme colors for the public schedule. Pulls from the Theme
 * global with safe `#rrggbb`-validated fallbacks so a missing or malformed
 * value never breaks the grid.
 */

export type ScheduleThemeColors = {
  past: string
  future: string
  booked: string
}

const HEX_RE = /^#[0-9a-f]{6}$/i

const DEFAULTS: ScheduleThemeColors = {
  past: '#141414',
  future: '#262626',
  booked: '#3d1414',
}

function pick(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_RE.test(value) ? value : fallback
}

export function resolveScheduleColors(
  theme: {
    scheduleSessionPast?: string | null
    scheduleSessionFuture?: string | null
    scheduleSessionBooked?: string | null
  } | null
  | undefined,
): ScheduleThemeColors {
  return {
    past: pick(theme?.scheduleSessionPast, DEFAULTS.past),
    future: pick(theme?.scheduleSessionFuture, DEFAULTS.future),
    booked: pick(theme?.scheduleSessionBooked, DEFAULTS.booked),
  }
}
