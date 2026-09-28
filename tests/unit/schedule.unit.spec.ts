import { describe, expect, it } from 'vitest'

import { extendRangeToSessions } from '@/lib/schedule'

const at = (h: number, m = 0) => {
  const d = new Date(2026, 9, 2, h, m) // local time, like the grid
  return d.toISOString()
}

describe('schedule grid range', () => {
  const opening = { startHour: 9, endHour: 22 }

  it('keeps the opening-hours range when every class fits', () => {
    expect(extendRangeToSessions(opening, [{ startsAt: at(18), durationMinutes: 60 }])).toEqual(opening)
  })

  it('widens up for an early class and down for a late one', () => {
    expect(
      extendRangeToSessions(opening, [
        { startsAt: at(7), durationMinutes: 60 },
        { startsAt: at(22, 30), durationMinutes: 45 },
      ]),
    ).toEqual({ startHour: 7, endHour: 24 })
  })

  it('rounds to whole hours and never leaves 0..24', () => {
    expect(extendRangeToSessions(opening, [{ startsAt: at(6, 45), durationMinutes: 30 }])).toEqual({
      startHour: 6,
      endHour: 22,
    })
    expect(extendRangeToSessions(opening, [{ startsAt: at(23, 30), durationMinutes: 120 }]).endHour).toBe(24)
  })
})
