import { describe, expect, it } from 'vitest'

import {
  BANNER_LEAD_MS,
  countdown,
  generateCheckInCode,
  inBannerWindow,
  isCheckInCode,
  sessionEnd,
} from '@/lib/scheduling'

describe('check-in codes', () => {
  it('are URL-safe, fixed length and pass their own format check', () => {
    const code = generateCheckInCode()
    expect(code).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(isCheckInCode(code)).toBe(true)
  })

  it('do not repeat', () => {
    const codes = new Set(Array.from({ length: 10_000 }, generateCheckInCode))
    expect(codes.size).toBe(10_000)
  })

  it('reject anything that is not a code', () => {
    for (const bad of ['', 'short', 'a'.repeat(23), '../../etc/passwd/aaaaaaa', null, 42]) {
      expect(isCheckInCode(bad)).toBe(false)
    }
  })
})

describe('upcoming-class banner and countdown', () => {
  const start = new Date('2026-10-01T18:00:00Z')
  const end = sessionEnd(start, 60)
  const at = (iso: string) => new Date(iso)

  it('shows from 24 hours before the start until the class ends', () => {
    expect(inBannerWindow(start, end, new Date(start.getTime() - BANNER_LEAD_MS - 1))).toBe(false)
    expect(inBannerWindow(start, end, new Date(start.getTime() - BANNER_LEAD_MS))).toBe(true)
    expect(inBannerWindow(start, end, at('2026-10-01T18:30:00Z'))).toBe(true)
    expect(inBannerWindow(start, end, end)).toBe(false)
  })

  it('counts down, then reports live, then over', () => {
    expect(countdown(start, end, at('2026-09-30T15:58:30Z'))).toEqual({
      phase: 'upcoming',
      days: 1,
      hours: 2,
      minutes: 1,
      seconds: 30,
    })
    expect(countdown(start, end, start)).toEqual({ phase: 'live' })
    expect(countdown(start, end, end)).toEqual({ phase: 'over' })
  })
})
