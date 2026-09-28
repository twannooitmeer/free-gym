import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { CancelButton } from '@/components/me/CancelButton'
import { ShowCodeButton } from '@/components/registration/ShowCodeButton'
import { Link, redirect } from '@/i18n/navigation'
import { qrSvg } from '@/lib/checkIn'
import { getGymProfile } from '@/lib/gymProfile'
import { formatEur } from '@/lib/pricing'
import { loadOwnRegistration } from '@/lib/registration'
import { formatDayHeader, formatTime } from '@/lib/schedule'
import { getSession } from '@/lib/session'

export const metadata = { robots: { index: false } }

export default async function RegistrationPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const t = await getTranslations('registration')

  const session = await getSession()
  if (session?.user.role !== 'customers') {
    return redirect({ href: `/login?next=/me/bookings/${id}`, locale })
  }
  const reg = await loadOwnRegistration(session.user.id, id, locale)
  if (!reg) notFound()

  const gym = await getGymProfile(locale)
  const when = `${formatDayHeader(reg.startsAt, locale)} · ${formatTime(reg.startsAt, locale)} – ${formatTime(reg.endsAt, locale)}`
  const title = reg.title || t('session')
  // Server component: renders once per request, so reading the clock is intended.
  // eslint-disable-next-line react-hooks/purity
  const isOver = reg.endsAt.getTime() < Date.now()
  const showCode = reg.code && reg.status === 'confirmed' && !isOver

  const rows: Array<[string, string]> = [
    [t('when'), when],
    ...(reg.teacherName ? ([[t('teacher'), reg.teacherName]] as Array<[string, string]>) : []),
    [t('where'), reg.location ?? gym.defaultLocation],
    [t('status'), t(`statuses.${reg.status}`)],
    [
      t('payment'),
      reg.amountCents > 0
        ? `${formatEur(reg.amountCents, locale)} · ${t(`payments.${reg.paymentStatus}`)}`
        : t(`payments.${reg.paymentStatus}`),
    ],
  ]

  return (
    <section>
      <div className="mx-auto max-w-xl px-6 py-16">
        <p className="mb-10">
          <Link
            href="/me"
            className="text-xs text-[color:var(--color-text-muted)] underline-offset-4 hover:underline"
          >
            ‹ {t('back')}
          </Link>
        </p>
        <span className="accent-bar mb-6" />
        <p className="text-xs uppercase tracking-widest text-[color:var(--color-text-muted)]">
          {t('kicker')}
        </p>
        <h1 className="display mt-2 text-4xl md:text-5xl">{title}</h1>

        <dl className="mt-10 divide-y divide-[color:var(--color-border)] border-y border-[color:var(--color-border)]">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-6 py-3 text-sm">
              <dt className="text-[color:var(--color-text-muted)]">{label}</dt>
              <dd className="text-right">{value}</dd>
            </div>
          ))}
        </dl>

        {showCode && (
          <div className="mt-10">
            <ShowCodeButton
              qrSvg={await qrSvg(reg.code!)}
              gymName={gym.name}
              title={title}
              when={when}
              labels={{ show: t('showCode'), hint: t('codeHint'), close: t('close') }}
            />
            <p className="mt-3 text-center text-xs text-[color:var(--color-text-muted)]">
              {t('codeExplainer')}
            </p>
          </div>
        )}
        {reg.status === 'attended' && (
          <p className="mt-10 text-sm text-[color:var(--color-text-muted)]">{t('checkedIn')}</p>
        )}

        {reg.status === 'confirmed' && !isOver && (
          <div className="mt-10 flex justify-end">
            <CancelButton bookingId={reg.id} />
          </div>
        )}
      </div>
    </section>
  )
}
