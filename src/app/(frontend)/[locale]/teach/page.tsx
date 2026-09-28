import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'

import { getSession } from '@/lib/session'
import { SignOutButton } from '@/components/me/SignOutButton'
import { redirect } from '@/i18n/navigation'
import { formatDayHeader, formatTime } from '@/lib/schedule'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

export default async function TeachPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('teach')

  const session = await getSession()
  if (!session?.user || session.user.role !== 'teachers') {
    redirect({ href: '/login?next=/teach&role=teacher', locale })
  }

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const teacher = await payload.findByID({
    collection: 'teachers',
    id: session!.user.id,
    overrideAccess: true,
    locale: locale as 'nl' | 'en',
  })

  // Upcoming sessions taught by this teacher.
  const sessionsRes = await payload.find({
    collection: 'sessions',
    where: {
      and: [
        { teacher: { equals: teacher.id } },
        // Server component: renders once per request, so reading the clock is intended.
        // eslint-disable-next-line react-hooks/purity
        { startsAt: { greater_than: new Date(Date.now() - 60 * 60_000).toISOString() } },
        { status: { not_equals: 'cancelled' } },
      ],
    },
    depth: 1,
    sort: 'startsAt',
    limit: 200,
    overrideAccess: true,
    locale: locale as 'nl' | 'en',
  })

  const sessionIds = sessionsRes.docs.map((s) => s.id)

  // Roster query: customer.name will populate, but field-level access on
  // Customers blocks email/phone for non-admins/non-self, so teachers see
  // only names. We still scope by sessionIds for safety.
  const bookingsRes =
    sessionIds.length > 0
      ? await payload.find({
          collection: 'bookings',
          where: {
            and: [
              { session: { in: sessionIds } },
              { status: { not_in: ['cancelled'] } },
            ],
          },
          depth: 1,
          limit: 1000,
          // Run as teacher so customer field-access trims contact details.
          user: { ...teacher, collection: 'teachers' },
          overrideAccess: false,
        })
      : { docs: [] as Array<{ id: number | string; session: number | string | { id: number | string }; customer: number | string | { name?: string } }> }

  // Map session id → list of customer names.
  const roster = new Map<number | string, string[]>()
  for (const b of bookingsRes.docs) {
    const sid = typeof b.session === 'object' && b.session ? (b.session as { id: number | string }).id : b.session
    const cust =
      typeof b.customer === 'object' && b.customer
        ? ((b.customer as { name?: string }).name ?? t('attendee'))
        : t('attendee')
    const list = roster.get(sid) ?? []
    list.push(cust)
    roster.set(sid, list)
  }

  return (
    <section>
      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="accent-bar mb-6" />
            <h1 className="display text-4xl md:text-5xl">{t('title')}</h1>
            <p className="mt-4 text-base text-[color:var(--color-text-muted)]">
              {t('greeting', { name: teacher.name })}
            </p>
          </div>
          <SignOutButton />
        </div>

        <div className="mt-14">
          <h2 className="display text-2xl">{t('upcoming')}</h2>
          {sessionsRes.docs.length === 0 ? (
            <p className="mt-4 text-sm text-[color:var(--color-text-muted)]">
              {t('noUpcoming')}
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-4">
              {sessionsRes.docs.map((s) => {
                const startsAt = new Date(s.startsAt as string)
                const duration = (s as { durationMinutes?: number }).durationMinutes ?? 60
                const endsAt = new Date(startsAt.getTime() + duration * 60_000)
                const type =
                  typeof (s as { type?: unknown }).type === 'object' && (s as { type?: { name?: string; color?: string } }).type
                    ? (s as { type: { name?: string; color?: string } }).type
                    : null
                const attendees = roster.get(s.id) ?? []
                const capacity = (s as { capacity?: number }).capacity ?? 0
                const title = (s as { title?: string }).title || type?.name || t('session')
                return (
                  <li
                    key={s.id}
                    className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/40 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="mt-1 h-10 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: type?.color ?? 'var(--color-accent)' }}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-[color:var(--color-text)]">
                          {title}
                        </p>
                        <p className="mt-0.5 text-xs text-[color:var(--color-text-muted)]">
                          {formatDayHeader(startsAt, locale)} ·{' '}
                          {formatTime(startsAt, locale)} – {formatTime(endsAt, locale)} ·{' '}
                          {t('attendeeCount', { count: attendees.length, capacity })}
                        </p>
                      </div>
                    </div>
                    {attendees.length > 0 ? (
                      <ul className="mt-3 flex flex-wrap gap-1.5 pl-4 text-xs">
                        {attendees.map((name, i) => (
                          <li
                            key={i}
                            className="rounded-full border border-[color:var(--color-border)] px-2.5 py-1 text-[color:var(--color-text)]"
                          >
                            {name}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 pl-4 text-xs text-[color:var(--color-text-muted)]">
                        {t('noAttendees')}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
