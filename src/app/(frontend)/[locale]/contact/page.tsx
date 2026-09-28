import { getTranslations, setRequestLocale } from 'next-intl/server'

import { getGymProfile } from '@/lib/gymProfile'

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('contact')
  const gym = await getGymProfile(locale)
  const rows = [
    { label: t('address'), value: gym.address, href: null },
    { label: t('email'), value: gym.contactEmail, href: gym.contactEmail && `mailto:${gym.contactEmail}` },
    {
      label: t('phone'),
      value: gym.contactPhone,
      href: gym.contactPhone && `tel:${gym.contactPhone.replace(/[^+\d]/g, '')}`,
    },
  ].filter((row) => row.value)

  return (
    <section>
      <div className="mx-auto max-w-4xl px-6 py-24">
        <span className="accent-bar mb-6" />
        <h1 className="display text-5xl md:text-7xl">{t('title')}</h1>
        <p className="mt-6 text-lg text-[color:var(--color-text-muted)]">{t('subtitle')}</p>

        {rows.length === 0 && (
          <p className="mt-12 text-[color:var(--color-text-muted)]">{t('notConfigured')}</p>
        )}
        {rows.length > 0 && (
        <dl className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-border)] md:grid-cols-3">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex flex-col gap-2 bg-[color:var(--color-surface)] p-6"
            >
              <dt className="text-xs uppercase tracking-widest text-[color:var(--color-text-muted)]">
                {row.label}
              </dt>
              <dd className="whitespace-pre-line text-base">
                {row.href ? (
                  <a href={row.href} className="hover:text-[color:var(--color-accent)]">
                    {row.value}
                  </a>
                ) : (
                  row.value
                )}
              </dd>
            </div>
          ))}
        </dl>
        )}
      </div>
    </section>
  )
}
