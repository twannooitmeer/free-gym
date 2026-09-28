import { getTranslations } from 'next-intl/server'

import { Link } from '@/i18n/navigation'
import { addDays, dateToYmd, formatWeekRange, startOfWeek } from '@/lib/schedule'

type SessionType = { id: number | string; name: string; slug: string }

type Props = {
  locale: string
  weekStart: Date
  selectedType?: string
  sessionTypes: SessionType[]
}

/**
 * Week navigator + type filter chips. Renders pure links so navigation
 * works without JavaScript and the schedule stays server-rendered.
 */
export async function ScheduleHeader({ locale, weekStart, selectedType, sessionTypes }: Props) {
  const t = await getTranslations('schedule')

  const prev = dateToYmd(addDays(weekStart, -7))
  const next = dateToYmd(addDays(weekStart, 7))
  const today = dateToYmd(startOfWeek(new Date()))

  const linkFor = (week: string, type?: string) => {
    const params = new URLSearchParams()
    params.set('week', week)
    if (type) params.set('type', type)
    return `/schedule?${params.toString()}` as const
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="display text-2xl">{formatWeekRange(weekStart, locale)}</h2>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={linkFor(prev, selectedType)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-[color:var(--color-border)] px-3 transition hover:border-[color:var(--color-text-muted)]"
            aria-label={t('prevWeek')}
          >
            <span aria-hidden="true">‹</span>
          </Link>
          <Link
            href={linkFor(today, selectedType)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-[color:var(--color-border)] px-3 transition hover:border-[color:var(--color-text-muted)]"
          >
            {t('thisWeek')}
          </Link>
          <Link
            href={linkFor(next, selectedType)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-[color:var(--color-border)] px-3 transition hover:border-[color:var(--color-text-muted)]"
            aria-label={t('nextWeek')}
          >
            <span aria-hidden="true">›</span>
          </Link>
        </div>
      </div>

      <nav aria-label={t('filterLabel')} className="flex flex-wrap gap-2 text-sm">
        <Link
          href={linkFor(dateToYmd(weekStart))}
          aria-current={!selectedType ? 'true' : undefined}
          className={`inline-flex min-h-10 items-center rounded-full border px-4 transition ${
            !selectedType
              ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)] text-white'
              : 'border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-text-muted)]'
          }`}
        >
          {t('allTypes')}
        </Link>
        {sessionTypes.map((type) => {
          const active = selectedType === type.slug
          return (
            <Link
              key={type.id}
              href={linkFor(dateToYmd(weekStart), type.slug)}
              aria-current={active ? 'true' : undefined}
              className={`inline-flex min-h-10 items-center rounded-full border px-4 transition ${
                active
                  ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)] text-white'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-text-muted)]'
              }`}
            >
              {type.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
