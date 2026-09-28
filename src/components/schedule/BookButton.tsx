import { getTranslations } from 'next-intl/server'

import { Link } from '@/i18n/navigation'

type Props = {
  sessionId: number | string
  /** True when the viewer has no session, link goes to /signup. */
  needsLogin?: boolean
  /** When set (capacity reached / already booked), render a disabled label instead. */
  disabledLabel?: 'full' | 'booked'
  className?: string
}

/**
 * Renders the per-session call-to-action in the schedule grid. Every state
 * eventually flows to /book/[sessionId], where the customer reviews the
 * price and confirms (or signs up first when not logged in).
 */
export async function BookButton({ sessionId, needsLogin, disabledLabel, className }: Props) {
  const t = await getTranslations('schedule')

  if (disabledLabel) {
    return (
      <span
        className={`inline-flex w-full items-center justify-center rounded-md border border-[color:var(--color-border)] px-2 py-1 text-xs font-medium text-[color:var(--color-text-dim)] ${className ?? ''}`}
      >
        {t(disabledLabel)}
      </span>
    )
  }

  if (needsLogin) {
    return (
      <Link
        href={`/signup?next=${encodeURIComponent(`/book/${sessionId}`)}`}
        className={`inline-flex w-full items-center justify-center rounded-md border border-[color:var(--color-border)] px-2 py-1 text-xs font-medium transition hover:border-[color:var(--color-accent)] ${className ?? ''}`}
      >
        {t('loginToBook')}
      </Link>
    )
  }

  return (
    <Link
      href={`/book/${sessionId}`}
      className={`inline-flex w-full items-center justify-center rounded-md bg-[color:var(--color-accent)] px-2 py-1 text-xs font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)] ${className ?? ''}`}
    >
      {t('book')}
    </Link>
  )
}
