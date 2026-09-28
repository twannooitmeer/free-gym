'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'

import { signupCustomer } from '@/app/actions/signupCustomer'
import { useRouter } from '@/i18n/navigation'

type Props = {
  /** Locale-relative path to land on after signup + auto-sign-in. */
  next?: string
}

export function SignupForm({ next }: Props) {
  const t = useTranslations('signup')
  const tErr = useTranslations('signup.errors')
  const router = useRouter()
  const locale = useLocale() === 'en' ? 'en' : 'nl'
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/me'

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const name = String(form.get('name') ?? '')
    const email = String(form.get('email') ?? '')
    const password = String(form.get('password') ?? '')

    startTransition(async () => {
      const res = await signupCustomer({ name, email, password, locale })
      if (!res.ok) {
        const key = res.error as
          | 'name-required'
          | 'invalid-email'
          | 'weak-password'
          | 'email-in-use'
          | 'failed'
        setError(tErr(key))
        return
      }

      // signupCustomer signs the new account in. If that step failed, send
      // them to the login page instead.
      if (!res.signedIn) {
        router.push(`/login?next=${encodeURIComponent(target)}`)
        return
      }
      // After signup the customer is signed in but unverified. Send them
      // to /verify; that page redirects to `target` once they enter the code.
      router.push(`/verify?next=${encodeURIComponent(target)}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit} className="mt-10 flex flex-col gap-5">
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-[color:var(--color-text-muted)]">{t('name')}</span>
        <input
          type="text"
          name="name"
          required
          autoComplete="name"
          className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 text-[color:var(--color-text)] outline-none transition focus:border-[color:var(--color-accent)]"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-[color:var(--color-text-muted)]">{t('email')}</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 text-[color:var(--color-text)] outline-none transition focus:border-[color:var(--color-accent)]"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-[color:var(--color-text-muted)]">{t('password')}</span>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 text-[color:var(--color-text)] outline-none transition focus:border-[color:var(--color-accent)]"
        />
        <span className="text-[10px] text-[color:var(--color-text-dim)]">
          {t('passwordHint')}
        </span>
      </label>
      {error && <p className="text-sm text-[color:var(--color-accent)]">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="mt-2 rounded-md bg-[color:var(--color-accent)] px-6 py-3 text-base font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)] disabled:opacity-60"
      >
        {isPending ? '…' : t('submit')}
      </button>
      <p className="text-xs text-[color:var(--color-text-muted)]">{t('verifyNote')}</p>
    </form>
  )
}
