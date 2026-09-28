import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { getSession } from '@/lib/session'
import { ConfirmBookingButton } from '@/components/booking/ConfirmBookingButton'
import { Link, redirect } from '@/i18n/navigation'
import { getEmailConfig } from '@/lib/emailConfig'
import { loadActiveMemberships } from '@/lib/memberships'
import { formatEur, quoteBookingPrice, type MembershipStatus } from '@/lib/pricing'
import { formatDayHeader, formatTime } from '@/lib/schedule'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

export default async function BookPage({
  params,
}: {
  params: Promise<{ locale: string; sessionId: string }>
}) {
  const { locale, sessionId } = await params
  setRequestLocale(locale)
  const t = await getTranslations('book')
  const tReason = await getTranslations('book.reason')

  // Auth gate: not logged in → signup. Wrong role → bounce to customer login.
  const authSession = await getSession()
  const nextPath = `/book/${sessionId}`
  if (!authSession?.user) {
    redirect({ href: `/signup?next=${encodeURIComponent(nextPath)}`, locale })
  }
  if (authSession!.user.role !== 'customers') {
    redirect({ href: `/login?next=${encodeURIComponent(nextPath)}`, locale })
  }

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  // Look up session + populate type/teacher for the summary card.
  let sessionDoc
  try {
    sessionDoc = await payload.findByID({
      collection: 'sessions',
      id: Number(sessionId),
      depth: 1,
      locale: locale as 'nl' | 'en',
    })
  } catch {
    notFound()
  }

  const customer = await payload.findByID({
    collection: 'customers',
    id: authSession!.user.id,
    overrideAccess: true,
  })

  // Verification gate: unverified customers are bounced to /verify and
  // come back here automatically once their email is confirmed. Skipped
  // entirely when the admin has turned email verification off.
  const emailCfg = await getEmailConfig()
  if (emailCfg.verificationRequired && !customer.emailVerified) {
    redirect({ href: `/verify?next=${encodeURIComponent(nextPath)}`, locale })
  }

  const sessionType =
    typeof sessionDoc.type === 'object' && sessionDoc.type
      ? sessionDoc.type
      : null
  const teacher =
    typeof sessionDoc.teacher === 'object' && sessionDoc.teacher
      ? sessionDoc.teacher
      : null

  // Capacity + already-booked guards (mirrors the schedule view).
  const existingBookings = await payload.find({
    collection: 'bookings',
    where: {
      and: [
        { session: { equals: sessionDoc.id } },
        { status: { not_in: ['cancelled'] } },
      ],
    },
    depth: 0,
    limit: 1000,
    overrideAccess: true,
  })
  const isFull =
    typeof sessionDoc.capacity === 'number' &&
    existingBookings.totalDocs >= sessionDoc.capacity
  const alreadyBooked = existingBookings.docs.some((b) => {
    const cid = typeof b.customer === 'object' ? b.customer?.id : b.customer
    return String(cid) === authSession!.user.id
  })

  const start = new Date(sessionDoc.startsAt as string)
  const duration = sessionDoc.durationMinutes ?? 60
  const end = new Date(start.getTime() + duration * 60_000)
  const isPast = end < new Date()
  const isCancelled = sessionDoc.status === 'cancelled'

  const quote = quoteBookingPrice(
    {
      id: sessionType?.id,
      priceCents: sessionType?.priceCents ?? 0,
      coveredByMembership: sessionType?.coveredByMembership ?? false,
    },
    { membershipStatus: (customer.membershipStatus ?? 'none') as MembershipStatus },
    await loadActiveMemberships(payload, customer.id),
  )

  const title = (sessionDoc as { title?: string }).title || sessionType?.name || t('session')

  return (
    <section>
      <div className="mx-auto max-w-2xl px-6 py-16">
        <span className="accent-bar mb-6" />
        <h1 className="display text-4xl md:text-5xl">{t('title')}</h1>
        <p className="mt-4 text-base text-[color:var(--color-text-muted)]">{t('subtitle')}</p>

        {/* Session summary */}
        <div
          className="mt-10 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6"
          style={{ borderLeft: `4px solid ${sessionType?.color ?? 'var(--color-accent)'}` }}
        >
          <p className="text-xs uppercase tracking-widest text-[color:var(--color-text-muted)]">
            {sessionType?.name ?? t('session')}
          </p>
          <h2 className="mt-1 text-2xl font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">
            {formatDayHeader(start, locale)} · {formatTime(start, locale)} –{' '}
            {formatTime(end, locale)}
            {teacher ? ` · ${t('with')} ${teacher.name}` : ''}
            {(sessionDoc as { location?: string }).location
              ? ` · ${(sessionDoc as { location?: string }).location}`
              : ''}
          </p>
          {sessionType?.description && (
            <p className="mt-4 text-sm text-[color:var(--color-text)]">{sessionType.description}</p>
          )}
        </div>

        {/* Price + action */}
        <div className="mt-8 rounded-lg border border-[color:var(--color-border)] p-6">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm text-[color:var(--color-text-muted)]">{t('priceLabel')}</span>
            <span className="display text-3xl">
              {quote.free ? t('free') : formatEur(quote.amountCents, locale)}
            </span>
          </div>
          <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">
            {tReason(quote.reason)}
          </p>

          {/* Action area: past / full / already booked block confirmation. */}
          <div className="mt-6 border-t border-[color:var(--color-border)] pt-6">
            {isCancelled ? (
              <p className="text-sm text-[color:var(--color-accent)]">{t('isCancelled')}</p>
            ) : isPast ? (
              <p className="text-sm text-[color:var(--color-text-muted)]">{t('isPast')}</p>
            ) : alreadyBooked ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-[color:var(--color-text)]">{t('alreadyBooked')}</p>
                <Link
                  href="/me"
                  className="inline-flex w-fit items-center justify-center rounded-md border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium transition hover:border-[color:var(--color-accent)]"
                >
                  {t('viewBookings')}
                </Link>
              </div>
            ) : isFull ? (
              <p className="text-sm text-[color:var(--color-accent)]">{t('isFull')}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {!quote.free && (
                  <p className="text-xs text-[color:var(--color-text-muted)]">
                    {t('payAtDeskNote')}
                  </p>
                )}
                <ConfirmBookingButton
                  sessionId={sessionDoc.id}
                  requiresPayment={!quote.free}
                />
              </div>
            )}
          </div>
        </div>

        <p className="mt-6 text-xs text-[color:var(--color-text-muted)]">
          <Link
            href="/schedule"
            className="underline-offset-4 hover:text-[color:var(--color-text)] hover:underline"
          >
            ‹ {t('backToSchedule')}
          </Link>
        </p>
      </div>
    </section>
  )
}
