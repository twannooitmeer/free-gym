import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'

import { getSession } from '@/lib/session'
import { VerifyForm } from '@/components/VerifyForm'
import { redirect } from '@/i18n/navigation'
import { getEmailConfig } from '@/lib/emailConfig'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

/**
 * Email-verification gate. Reached after signup (auto-routed by SignupForm)
 * or whenever an unverified customer tries to book.
 *
 * - Not signed in: bounce to /login (then back here after).
 * - Wrong role: bounce to /me (only customers need to verify).
 * - Already verified: skip ahead to the next param or /me.
 */
export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ next?: string }>
}) {
  const { locale } = await params
  const { next } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('verify')

  const authSession = await getSession()
  if (!authSession?.user) {
    const target = `/verify${next ? `?next=${encodeURIComponent(next)}` : ''}`
    redirect({ href: `/login?next=${encodeURIComponent(target)}`, locale })
  }
  if (authSession!.user.role !== 'customers') {
    redirect({ href: '/me', locale })
  }

  // If verification is turned off entirely, skip this page.
  const emailCfg = await getEmailConfig()
  const safeNext =
    next && next.startsWith('/') && !next.startsWith('//') ? next : '/me'
  if (!emailCfg.verificationRequired) {
    redirect({ href: safeNext, locale })
  }

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const customer = await payload.findByID({
    collection: 'customers',
    id: authSession!.user.id,
    overrideAccess: true,
  })

  if (customer.emailVerified) {
    redirect({ href: safeNext, locale })
  }

  return (
    <section>
      <div className="mx-auto max-w-md px-6 py-24">
        <span className="accent-bar mb-6" />
        <h1 className="display text-4xl md:text-5xl">{t('title')}</h1>
        <p className="mt-4 text-base text-[color:var(--color-text-muted)]">{t('subtitle')}</p>
        <VerifyForm next={next} email={customer.email} />
      </div>
    </section>
  )
}
