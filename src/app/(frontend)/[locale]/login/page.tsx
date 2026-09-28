import { getTranslations, setRequestLocale } from 'next-intl/server'

import { LoginForm } from '@/components/LoginForm'
import { Link } from '@/i18n/navigation'

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ role?: string; next?: string }>
}) {
  const { locale } = await params
  const { role: roleParam, next } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('login')

  const role: 'customer' | 'teacher' = roleParam === 'teacher' ? 'teacher' : 'customer'
  const otherHref = role === 'teacher' ? '/login' : '/login?role=teacher'
  const otherLabelKey = role === 'teacher' ? 'asCustomer' : 'asTeacher'

  return (
    <section>
      <div className="mx-auto max-w-md px-6 py-24">
        <span className="accent-bar mb-6" />
        <h1 className="display text-4xl md:text-5xl">
          {role === 'teacher' ? t('teacherTitle') : t('title')}
        </h1>
        <p className="mt-4 text-base text-[color:var(--color-text-muted)]">
          {role === 'teacher' ? t('teacherSubtitle') : t('subtitle')}
        </p>
        <LoginForm role={role} next={next} />
        <p className="mt-6 text-xs text-[color:var(--color-text-muted)]">
          <Link
            href={otherHref}
            className="text-[color:var(--color-text-muted)] underline-offset-4 hover:text-[color:var(--color-text)] hover:underline"
          >
            {t(otherLabelKey)}
          </Link>
        </p>
      </div>
    </section>
  )
}

