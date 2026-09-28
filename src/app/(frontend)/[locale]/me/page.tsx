import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'

import { getSession } from '@/lib/session'
import { CancelButton } from '@/components/me/CancelButton'
import { ProfileForm } from '@/components/me/ProfileForm'
import { SignOutButton } from '@/components/me/SignOutButton'
import { Link, redirect } from '@/i18n/navigation'
import { loadActiveMemberships } from '@/lib/memberships'
import { isMembershipUsable } from '@/lib/pricing'
import { formatDayHeader, formatTime } from '@/lib/schedule'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

export default async function MePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('me')

  const session = await getSession()
  if (!session?.user || session.user.role !== 'customers') {
    redirect({ href: '/login?next=/me', locale })
  }

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  // Customer doc for profile + ownership.
  const customer = await payload.findByID({
    collection: 'customers',
    id: session!.user.id,
    overrideAccess: true,
    locale: locale as 'nl' | 'en',
  })

  // All non-cancelled bookings for this customer, with the session + type +
  // teacher populated. Volume per customer is small, so we sort in JS.
  const bookingsRes = await payload.find({
    collection: 'bookings',
    where: {
      and: [
        { customer: { equals: customer.id } },
        { status: { not_in: ['cancelled'] } },
      ],
    },
    depth: 2,
    limit: 200,
    overrideAccess: true,
    locale: locale as 'nl' | 'en',
  })

  // Server component: renders once per request, so reading the clock is intended.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  type Row = {
    id: number | string
    startsAt: Date
    endsAt: Date
    title: string
    typeName: string | null
    typeColor: string | null
    teacherName: string | null
    location: string | null
  }

  const rows: Row[] = []
  for (const b of bookingsRes.docs) {
    const s = typeof b.session === 'object' && b.session ? b.session : null
    if (!s) continue
    const startsAt = new Date(s.startsAt as string)
    const duration = (s as { durationMinutes?: number }).durationMinutes ?? 60
    const endsAt = new Date(startsAt.getTime() + duration * 60_000)
    const type =
      typeof (s as { type?: unknown }).type === 'object' && (s as { type?: { name?: string; color?: string } }).type
        ? (s as { type: { name?: string; color?: string } }).type
        : null
    const teacher =
      typeof (s as { teacher?: unknown }).teacher === 'object' && (s as { teacher?: { name?: string } }).teacher
        ? (s as { teacher: { name?: string } }).teacher
        : null
    rows.push({
      id: b.id,
      startsAt,
      endsAt,
      title: (s as { title?: string }).title || type?.name || t('session'),
      typeName: type?.name ?? null,
      typeColor: type?.color ?? null,
      teacherName: teacher?.name ?? null,
      location: (s as { location?: string }).location ?? null,
    })
  }
  rows.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())

  const upcoming = rows.filter((r) => r.endsAt.getTime() >= now)
  const past = rows.filter((r) => r.endsAt.getTime() < now).reverse().slice(0, 10)

  // Active memberships (depth 1 so `type` is populated for billing model + name).
  const memberships = await loadActiveMemberships(payload, customer.id)
  const usableMemberships = memberships.filter(isMembershipUsable)

  const dob =
    customer.dateOfBirth && typeof customer.dateOfBirth === 'string'
      ? customer.dateOfBirth.slice(0, 10)
      : ''

  return (
    <section>
      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="accent-bar mb-6" />
            <h1 className="display text-4xl md:text-5xl">{t('title')}</h1>
            <p className="mt-4 text-base text-[color:var(--color-text-muted)]">
              {t('greeting', { name: customer.name })}
            </p>
          </div>
          <SignOutButton />
        </div>

        {/* Upcoming bookings */}
        <div className="mt-14">
          <h2 className="display text-2xl">{t('upcoming')}</h2>
          {upcoming.length === 0 ? (
            <p className="mt-4 text-sm text-[color:var(--color-text-muted)]">
              {t('noUpcoming')}
            </p>
          ) : (
            <ul className="mt-4 flex flex-col divide-y divide-[color:var(--color-border)] border-y border-[color:var(--color-border)]">
              {upcoming.map((r) => (
                <li key={r.id} className="flex items-center gap-4 py-4">
                  <div
                    className="h-10 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: r.typeColor ?? 'var(--color-accent)' }}
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/me/bookings/${r.id}`}
                      className="block truncate text-sm font-semibold text-[color:var(--color-text)] underline-offset-4 hover:underline"
                    >
                      {r.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-[color:var(--color-text-muted)]">
                      {formatDayHeader(r.startsAt, locale)} ·{' '}
                      {formatTime(r.startsAt, locale)} – {formatTime(r.endsAt, locale)}
                      {r.teacherName ? ` · ${t('with')} ${r.teacherName}` : ''}
                      {r.location ? ` · ${r.location}` : ''}
                    </p>
                  </div>
                  <CancelButton bookingId={r.id} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Memberships */}
        <div className="mt-14">
          <h2 className="display text-2xl">{t('memberships')}</h2>
          {usableMemberships.length === 0 ? (
            <p className="mt-4 text-sm text-[color:var(--color-text-muted)]">
              {t('noMemberships')}
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {usableMemberships.map((m) => {
                const type =
                  m.type && typeof m.type === 'object'
                    ? (m.type as { name?: string; billingModel?: string })
                    : null
                const model = type?.billingModel ?? 'unlimited'
                const endsAt = m.endsAt ? new Date(m.endsAt) : null
                return (
                  <li
                    key={m.id}
                    className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4"
                    style={{ borderLeft: '4px solid var(--color-accent)' }}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-semibold text-[color:var(--color-text)]">
                        {type?.name ?? t('membership')}
                      </p>
                      {model === 'credits' ? (
                        <span className="display text-xl">
                          {Number(m.creditsRemaining ?? 0)}
                          <span className="ml-1 text-xs font-normal text-[color:var(--color-text-muted)]">
                            {t('creditsLabel')}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs uppercase tracking-widest text-[color:var(--color-accent)]">
                          {t('unlimitedLabel')}
                        </span>
                      )}
                    </div>
                    {endsAt && (
                      <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                        {t('validUntil', { date: formatDayHeader(endsAt, locale) })}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Past bookings (last 10) */}
        {past.length > 0 && (
          <div className="mt-12">
            <h2 className="display text-2xl">{t('history')}</h2>
            <ul className="mt-4 flex flex-col divide-y divide-[color:var(--color-border)]/60 text-sm">
              {past.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-4 py-2.5 text-[color:var(--color-text-muted)]"
                >
                  <span className="truncate">{r.title}</span>
                  <span className="tabular-nums text-xs">
                    {formatDayHeader(r.startsAt, locale)} · {formatTime(r.startsAt, locale)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Profile */}
        <div className="mt-16">
          <h2 className="display text-2xl">{t('profile')}</h2>
          <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">
            {t('profileHint')}
          </p>
          <div className="mt-6 max-w-md">
            <ProfileForm
              initial={{
                name: customer.name ?? '',
                phone: (customer as { phone?: string | null }).phone ?? '',
                dateOfBirth: dob,
              }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
