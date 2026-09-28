import { NextIntlClientProvider } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import React from 'react'

import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { UpcomingBanner } from '@/components/UpcomingBanner'
import { routing } from '@/i18n/routing'
import { getGymProfile } from '@/lib/gymProfile'

import '../styles.css'

// Every page shows data from the database (Site Settings, the schedule, the
// signed-in user), so pages render per request. That also keeps the Docker
// build free of any database or secret: nothing is pre-rendered at build time.
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const gym = await getGymProfile(locale)
  return {
    title: { default: gym.name, template: `%s · ${gym.name}` },
    description: gym.tagline ?? undefined,
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!routing.locales.includes(locale as 'nl' | 'en')) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('nav')

  return (
    <html lang={locale} className="bg-[color:var(--color-bg)] text-[color:var(--color-text)]">
      <head>
        {/* bunny.net fonts mirror Google Fonts without calling Google. */}
        <link rel="preconnect" href="https://fonts.bunny.net" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.bunny.net/css?family=inter:400,500,600,700|anton:400&display=swap"
        />
      </head>
      <body className="flex min-h-screen flex-col antialiased">
        <NextIntlClientProvider>
          <a href="#main" className="skip-link">
            {t('skipToContent')}
          </a>
          <SiteHeader />
          <UpcomingBanner />
          <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
            {children}
          </main>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
