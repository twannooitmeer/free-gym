import { getTranslations, setRequestLocale } from 'next-intl/server'

import { CheckInButton } from '@/components/checkin/CheckInButton'
import { Link } from '@/i18n/navigation'
import { findBookingByCode } from '@/lib/checkIn'
import { toRegistration } from '@/lib/registration'
import { formatDayHeader, formatTime } from '@/lib/schedule'
import { getStaffUser } from '@/lib/session'

export const metadata = { robots: { index: false } }

/**
 * Where a scanned QR code lands. Staff (an admin, or the teacher of the
 * class) see who it is and can check them in. Anyone else sees only that
 * this is a check-in code: no name, no class, nothing to learn from a
 * photo of someone's screen.
 */
export default async function CheckInPage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>
}) {
  const { locale, code } = await params
  setRequestLocale(locale)
  const t = await getTranslations('checkin')

  const staff = await getStaffUser()
  const shell = (children: React.ReactNode) => (
    <section>
      <div className="mx-auto max-w-xl px-6 py-16">
        <span className="accent-bar mb-6" />
        <h1 className="display text-4xl md:text-5xl">{t('title')}</h1>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  )

  if (!staff) {
    return shell(
      <>
        <p className="text-[color:var(--color-text-muted)]">{t('forStaff')}</p>
        <Link
          href={`/login?role=teacher&next=/checkin/${code}`}
          className="mt-6 inline-block text-sm underline underline-offset-4"
        >
          {t('staffLogin')}
        </Link>
      </>,
    )
  }

  const booking = await findBookingByCode(code)
  const reg = booking && toRegistration(booking)
  if (!reg) return shell(<p className="text-[color:var(--color-accent-text)]">{t('errors.not-found')}</p>)
  if (staff.collection === 'teachers' && String(reg.teacherId) !== staff.id) {
    return shell(<p className="text-[color:var(--color-accent-text)]">{t('errors.not-your-class')}</p>)
  }

  const when = `${formatDayHeader(reg.startsAt, locale)} · ${formatTime(reg.startsAt, locale)} – ${formatTime(reg.endsAt, locale)}`
  return shell(
    <>
      <p className="text-2xl font-semibold">{reg.customerName}</p>
      <p className="mt-1 text-[color:var(--color-text-muted)]">
        {reg.title} · {when}
      </p>
      <div className="mt-8">
        {reg.status === 'cancelled' && (
          <p className="text-[color:var(--color-accent-text)]">{t('errors.cancelled')}</p>
        )}
        {reg.status === 'attended' && (
          <p className="text-lg font-semibold">
            ✓{' '}
            {reg.checkedInAt
              ? t('checkedInAt', { time: formatTime(new Date(reg.checkedInAt), locale) })
              : t('checkedIn')}
          </p>
        )}
        {reg.status === 'noshow' && <p>{t('noShow')}</p>}
        {reg.status === 'confirmed' && <CheckInButton code={code} />}
      </div>
    </>,
  )
}
