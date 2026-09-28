import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Link } from '@/i18n/navigation'

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('home')
  const tNav = await getTranslations('nav')

  const cards = [
    { key: 'group' as const, kicker: '01' },
    { key: 'pt' as const, kicker: '02' },
    { key: 'sparring' as const, kicker: '03' },
  ]

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 py-24 md:grid-cols-12 md:py-32">
          <div className="md:col-span-7">
            <span className="accent-bar mb-8" />
            <h1 className="display text-6xl md:text-8xl">
              {t('heroLine1')}
              <br />
              {t('heroLine2Prefix')}{' '}
              <span className="text-[color:var(--color-accent)]">{t('heroLine2Highlight')}</span>{' '}
              {t('heroLine2Suffix')}
            </h1>
            <p className="mt-8 max-w-xl text-lg text-[color:var(--color-text-muted)]">
              {t('heroSubtitle')}
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/try-out"
                className="rounded-md bg-[color:var(--color-accent)] px-6 py-3 text-base font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)]"
              >
                {tNav('bookTrial')}
              </Link>
              <Link
                href="/schedule"
                className="rounded-md border border-[color:var(--color-border)] px-6 py-3 text-base font-medium transition hover:border-[color:var(--color-text-muted)]"
              >
                {t('ctaSecondary')}
              </Link>
            </div>
          </div>
          <div className="hidden md:col-span-5 md:flex md:items-end">
            <div className="display w-full text-right text-[10rem] leading-none text-[color:var(--color-surface-2)]">
              03
            </div>
          </div>
        </div>
      </section>

      {/* Offerings */}
      <section className="border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="mb-12 flex items-end justify-between">
            <div>
              <span className="accent-bar mb-4" />
              <h2 className="display text-4xl md:text-5xl">{t('offerHeading')}</h2>
            </div>
            <Link
              href="/schedule"
              className="hidden text-sm font-medium text-[color:var(--color-text-muted)] transition hover:text-[color:var(--color-accent)] md:block"
            >
              {t('viewSchedule')} →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-px bg-[color:var(--color-border)] md:grid-cols-3">
            {cards.map((card) => (
              <div
                key={card.kicker}
                className="group flex flex-col gap-4 bg-[color:var(--color-surface)] p-10 transition hover:bg-[color:var(--color-surface-2)]"
              >
                <span className="display text-xl text-[color:var(--color-accent)]">
                  {card.kicker}
                </span>
                <h3 className="display text-3xl">{t(`cards.${card.key}.title`)}</h3>
                <p className="text-[color:var(--color-text-muted)]">
                  {t(`cards.${card.key}.body`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quote */}
      <section className="border-t border-[color:var(--color-border)]">
        <div className="mx-auto max-w-4xl px-6 py-24 text-center">
          <p className="display text-3xl leading-tight md:text-5xl">
            {t('quote.line1')}
            <br />
            {t('quote.line2')}
            <br />
            <span className="text-[color:var(--color-accent)]">{t('quote.line3Highlight')}</span>
          </p>
          <p className="mt-6 text-sm uppercase tracking-widest text-[color:var(--color-text-muted)]">
            {t('quote.attribution')}
          </p>
        </div>
      </section>
    </>
  )
}
