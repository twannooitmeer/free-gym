import { getTranslations, setRequestLocale } from 'next-intl/server'

import { getGymProfile } from '@/lib/gymProfile'

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('about')
  const gym = await getGymProfile(locale)

  return (
    <section>
      <div className="mx-auto max-w-3xl px-6 py-24">
        <span className="accent-bar mb-6" />
        <h1 className="display text-5xl md:text-7xl">{t('title', { name: gym.name })}</h1>
        <p className="mt-6 text-lg text-[color:var(--color-text-muted)]">{t('subtitle')}</p>
        <p className="mt-10 whitespace-pre-line leading-relaxed">{gym.about ?? t('bodyDefault')}</p>
      </div>
    </section>
  )
}
