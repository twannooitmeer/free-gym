'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { Link } from '@/i18n/navigation'
import { countdown } from '@/lib/scheduling/countdown'

type Props = {
  bookingId: number
  title: string
  startsAtIso: string
  endsAtIso: string
  /** Server render time, so the first client render matches the server's. */
  nowMs: number
}

/** The banner's live part: ticks every second, hides itself once the class is over. */
export function UpcomingCountdown({ bookingId, title, startsAtIso, endsAtIso, nowMs }: Props) {
  const t = useTranslations('banner')
  const [now, setNow] = useState(nowMs)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const c = countdown(new Date(startsAtIso), new Date(endsAtIso), new Date(now))
  if (c.phase === 'over') return null

  const time =
    c.phase === 'live'
      ? null
      : c.days > 0
        ? t('inDays', { days: c.days, hours: c.hours })
        : c.hours > 0
          ? t('inHours', { hours: c.hours, minutes: c.minutes })
          : t('inMinutes', { minutes: c.minutes, seconds: c.seconds })

  return (
    <div className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm">
        <p role="status" aria-live="off">
          <span className="font-semibold">{title}</span>{' '}
          <span className="text-[color:var(--color-text-muted)]">
            {time ? t('startsIn', { time }) : t('live')}
          </span>
        </p>
        <Link
          href={`/me/bookings/${bookingId}`}
          className="rounded-md bg-[color:var(--color-accent)] px-3 py-1.5 font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)]"
        >
          {t('open')}
        </Link>
      </div>
    </div>
  )
}
