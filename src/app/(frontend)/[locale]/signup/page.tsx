import { getTranslations, setRequestLocale } from 'next-intl/server'

import { SignupForm } from '@/components/SignupForm'
import { Link } from '@/i18n/navigation'

export default async function SignupPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ next?: string }>
}) {
  const { locale } = await params
  const { next } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('signup')

  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : '/login'

  return (
    <section>
      <div className="mx-auto max-w-md px-6 py-24">
        <span className="accent-bar mb-6" />
        <h1 className="display text-4xl md:text-5xl">{t('title')}</h1>
        <p className="mt-4 text-base text-[color:var(--color-text-muted)]">{t('subtitle')}</p>
        <SignupForm next={next} />
        <p className="mt-6 text-xs text-[color:var(--color-text-muted)]">
          {t('haveAccount')}{' '}
          <Link
            href={loginHref}
            className="text-[color:var(--color-text)] underline-offset-4 hover:underline"
          >
            {t('logInInstead')}
          </Link>
        </p>
      </div>
    </section>
  )
}
