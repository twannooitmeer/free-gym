'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'

import { signIn } from '@/app/actions/auth'
import { useRouter } from '@/i18n/navigation'

type Props = {
  /** Which account type to sign in as. Defaults to customer. */
  role?: 'customer' | 'teacher'
  /** Locale-relative path to redirect to on success. Defaults to /me (customer) or /teach (teacher). */
  next?: string
}

export function LoginForm({ role = 'customer', next }: Props) {
  const t = useTranslations('login')
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const fallbackNext = role === 'teacher' ? '/teach' : '/me'
  // Only allow local paths to avoid open-redirect via the ?next= param.
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : fallbackNext

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const email = String(form.get('email') ?? '')
    const password = String(form.get('password') ?? '')

    startTransition(async () => {
      const res = await signIn(role, email, password)
      if (!res.ok) {
        setError(t('error'))
        return
      }
      router.push(target)
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit} className="mt-10 flex flex-col gap-5">
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
          autoComplete="current-password"
          className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 text-[color:var(--color-text)] outline-none transition focus:border-[color:var(--color-accent)]"
        />
      </label>
      {error && <p role="alert" className="text-sm text-[color:var(--color-accent-text)]">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="mt-2 rounded-md bg-[color:var(--color-accent)] px-6 py-3 text-base font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)] disabled:opacity-60"
      >
        {isPending ? '…' : t('submit')}
      </button>
      <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">{t('noAccount')}</p>
    </form>
  )
}
