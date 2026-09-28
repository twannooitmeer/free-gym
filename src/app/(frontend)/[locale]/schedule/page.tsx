import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'

import { getSession } from '@/lib/session'
import { ScheduleGrid, type ScheduleSession } from '@/components/schedule/ScheduleGrid'
import { ScheduleHeader } from '@/components/schedule/ScheduleHeader'
import { ScheduleLegend } from '@/components/schedule/ScheduleLegend'
import {
  buildOpeningMap,
  gridRangeFromHours,
  startOfWeek,
  weekRange,
  ymdToDate,
  type OpeningHour,
} from '@/lib/schedule'
import { resolveScheduleColors } from '@/lib/scheduleTheme'
import config from '@/payload.config'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ week?: string; type?: string }>
}

export default async function SchedulePage({ params, searchParams }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const { week, type } = await searchParams
  const t = await getTranslations('schedule')

  const weekStart = week ? startOfWeek(ymdToDate(week)) : startOfWeek(new Date())
  const { from, to } = weekRange(weekStart)

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const session = await getSession()
  const viewerIsCustomer = session?.user?.role === 'customers'

  // Opening hours drive the visible hour range on the grid.
  const settings = await payload.findGlobal({ slug: 'settings', depth: 0 })
  const openingHours = (settings.openingHours ?? []) as OpeningHour[]
  const { startHour, endHour } = gridRangeFromHours(openingHours)
  const openingMap = buildOpeningMap(openingHours)

  // Admin-tunable schedule background colors.
  const theme = await payload.findGlobal({ slug: 'theme', depth: 0 })
  const themeColors = resolveScheduleColors(theme)

  // Session-type filter chips. `locale` triggers Payload to localize `name`.
  const types = await payload.find({
    collection: 'session-types',
    locale: locale as 'nl' | 'en',
    limit: 100,
    sort: 'name',
    depth: 0,
  })
  const selectedType = types.docs.find((d) => d.slug === type)

  const sessions = await payload.find({
    collection: 'sessions',
    locale: locale as 'nl' | 'en',
    depth: 1,
    limit: 500,
    sort: 'startsAt',
    where: {
      and: [
        { startsAt: { greater_than_equal: from.toISOString() } },
        { startsAt: { less_than: to.toISOString() } },
        { status: { not_equals: 'cancelled' } },
        ...(selectedType ? [{ type: { equals: selectedType.id } }] : []),
      ],
    },
  })

  // One aggregate booking query keeps the grid render cheap regardless of
  // how many sessions are on screen.
  const sessionIds = sessions.docs.map((s) => s.id)
  const bookingCounts = new Map<number | string, number>()
  const myBookings = new Set<number | string>()

  if (sessionIds.length > 0) {
    const allBookings = await payload.find({
      collection: 'bookings',
      depth: 0,
      limit: 5000,
      overrideAccess: true,
      where: {
        and: [
          { session: { in: sessionIds } },
          { status: { not_in: ['cancelled'] } },
        ],
      },
    })
    for (const b of allBookings.docs) {
      const sid = typeof b.session === 'object' ? b.session.id : b.session
      bookingCounts.set(sid, (bookingCounts.get(sid) ?? 0) + 1)
      if (
        viewerIsCustomer &&
        (typeof b.customer === 'object'
          ? String(b.customer.id) === session?.user.id
          : String(b.customer) === session?.user.id)
      ) {
        myBookings.add(sid)
      }
    }
  }

  const gridSessions: ScheduleSession[] = sessions.docs.map((s) => {
    const sType = typeof s.type === 'object' && s.type ? s.type : null
    const sTeacher = typeof s.teacher === 'object' && s.teacher ? s.teacher : null
    return {
      id: s.id,
      title: s.title ?? null,
      startsAt: s.startsAt,
      durationMinutes: s.durationMinutes ?? 60,
      capacity: s.capacity ?? 16,
      location: s.location ?? null,
      type: sType
        ? { id: sType.id, name: sType.name, slug: sType.slug, color: sType.color ?? null }
        : null,
      teacher: sTeacher ? { id: sTeacher.id, name: sTeacher.name } : null,
      bookingCount: bookingCounts.get(s.id) ?? 0,
      bookedByMe: myBookings.has(s.id),
    }
  })

  return (
    <section>
      <div className="mx-auto max-w-7xl px-6 py-16">
        <span className="accent-bar mb-6" />
        <h1 className="display text-5xl md:text-7xl">{t('title')}</h1>
        <p className="mt-4 max-w-2xl text-[color:var(--color-text-muted)]">{t('subtitle')}</p>

        <div className="mt-12 flex flex-col gap-8">
          <ScheduleHeader
            locale={locale}
            weekStart={weekStart}
            selectedType={type}
            sessionTypes={types.docs.map((d) => ({ id: d.id, name: d.name, slug: d.slug }))}
          />
          <ScheduleLegend colors={themeColors} />
          <ScheduleGrid
            weekStart={weekStart}
            locale={locale}
            sessions={gridSessions}
            viewerIsCustomer={viewerIsCustomer}
            startHour={startHour}
            endHour={endHour}
            openingMap={openingMap}
            closedLabel={t('closed')}
            themeColors={themeColors}
          />
        </div>
      </div>
    </section>
  )
}

// Always render fresh so the "now" line and booking counts are current.
export const dynamic = 'force-dynamic'
