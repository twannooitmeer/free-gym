import { getLocale } from 'next-intl/server'

import { nextUpcomingRegistration } from '@/lib/registration'
import { getSession } from '@/lib/session'

import { UpcomingCountdown } from './UpcomingCountdown'

/**
 * Site-wide banner for a signed-in customer whose class starts within 24
 * hours (or is running): what, a live countdown, and a link straight to
 * the registration with the check-in code. One small query per page for
 * signed-in customers only.
 */
export async function UpcomingBanner() {
  const session = await getSession()
  if (session?.user.role !== 'customers') return null
  const locale = await getLocale()
  // Server component: renders once per request, so reading the clock is intended.
  // eslint-disable-next-line react-hooks/purity
  const now = new Date(Date.now())
  const next = await nextUpcomingRegistration(session.user.id, locale, now)
  if (!next) return null
  return (
    <UpcomingCountdown
      bookingId={next.id}
      title={next.title}
      startsAtIso={next.startsAt.toISOString()}
      endsAtIso={next.endsAt.toISOString()}
      nowMs={now.getTime()}
    />
  )
}
