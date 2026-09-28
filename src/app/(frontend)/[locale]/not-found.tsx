import { getTranslations } from 'next-intl/server'

import { Link } from '@/i18n/navigation'

export default async function NotFound() {
  const t = await getTranslations('notFound')
  return (
    <section>
      <div className="mx-auto max-w-2xl px-6 py-24">
        <span className="accent-bar mb-6" />
        <p className="text-sm uppercase tracking-widest text-[color:var(--color-text-muted)]">404</p>
        <h1 className="display mt-2 text-5xl md:text-7xl">{t('title')}</h1>
        <p className="mt-6 text-lg text-[color:var(--color-text-muted)]">{t('body')}</p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/schedule"
            className="inline-flex min-h-11 items-center rounded-md bg-[color:var(--color-accent)] px-6 font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)]"
          >
            {t('toSchedule')}
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-md border border-[color:var(--color-border)] px-6 font-medium transition hover:border-[color:var(--color-text-muted)]"
          >
            {t('toHome')}
          </Link>
        </div>
      </div>
    </section>
  )
}
