import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Link } from '@/i18n/navigation'

export default async function TryOutPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('tryOut')

  return (
    <section>
      <div className="mx-auto max-w-4xl px-6 py-24">
        <span className="accent-bar mb-6" />
        <h1 className="display text-5xl md:text-7xl">{t('title')}</h1>
        <p className="mt-6 text-lg text-[color:var(--color-text-muted)]">{t('subtitle')}</p>
        <p className="mt-10 max-w-2xl">{t('intro')}</p>
        <div className="mt-10">
          <Link
            href="/schedule"
            className="inline-block rounded-md bg-[color:var(--color-accent)] px-6 py-3 text-base font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)]"
          >
            {t('cta')}
          </Link>
        </div>
      </div>
    </section>
  )
}
