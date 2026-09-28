'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'

import { resendVerification } from '@/app/actions/resendVerification'
import { verifyEmail } from '@/app/actions/verifyEmail'

type Props = {
  /** Locale-relative path to land on after successful verification. */
  next?: string
  /** Customer email shown for context (already auto-signed-in by this point). */
  email: string
}

export function VerifyForm({ next, email }: Props) {
  const t = useTranslations('verify')
  const tErr = useTranslations('verify.errors')
  const locale = useLocale() === 'en' ? 'en' : 'nl'

  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isResending, startResend] = useTransition()

  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/me'

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    const form = new FormData(e.currentTarget)
    const code = String(form.get('code') ?? '').trim()

    startTransition(async () => {
      const res = await verifyEmail({ code })
      if (!res.ok) {
        const key = res.error as
          | 'invalid'
          | 'expired'
          | 'no-code'
          | 'too-many-attempts'
          | 'not-authenticated'
          | 'wrong-role'
          | 'failed'
        setError(tErr(key))
        return
      }
      // Hard navigation: router.push + refresh inside a transition after a
      // Server Action is racy in Next 16 / React 19 and sometimes only fires
      // the prefetch without committing the navigation. window.location is
      // bulletproof and we're leaving the verify page for good anyway.
      const href = `/${locale}${target}`
      window.location.assign(href)
    })
  }

  const onResend = () => {
    setError(null)
    setInfo(null)
    startResend(async () => {
      const res = await resendVerification({ locale })
      if (!res.ok) {
        if (res.error === 'rate-limited' && res.retryInSec) {
          setError(t('rateLimited', { sec: res.retryInSec }))
        } else {
          setError(tErr('failed'))
        }
        return
      }
      setInfo(t('resent'))
    })
  }

  return (
    <form onSubmit={onSubmit} className="mt-10 flex flex-col gap-5">
      <p className="text-sm text-[color:var(--color-text-muted)]">
        {t.rich('sentTo', {
          email,
          b: (chunks) => <strong className="text-[color:var(--color-text)]">{chunks}</strong>,
        })}
      </p>
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-[color:var(--color-text-muted)]">{t('codeLabel')}</span>
        <input
          type="text"
          name="code"
          required
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoComplete="one-time-code"
          autoFocus
          className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono text-[color:var(--color-text)] outline-none transition focus:border-[color:var(--color-accent)]"
        />
      </label>
      {error && <p className="text-sm text-[color:var(--color-accent)]">{error}</p>}
      {info && <p className="text-sm text-[color:var(--color-text-muted)]">{info}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="mt-2 rounded-md bg-[color:var(--color-accent)] px-6 py-3 text-base font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)] disabled:opacity-60"
      >
        {isPending ? '…' : t('submit')}
      </button>
      <button
        type="button"
        onClick={onResend}
        disabled={isResending}
        className="text-xs text-[color:var(--color-text-muted)] underline-offset-4 hover:underline disabled:opacity-60"
      >
        {isResending ? '…' : t('resend')}
      </button>
    </form>
  )
}
