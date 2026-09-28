'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'

import { updateProfile } from '@/app/actions/updateProfile'

type Props = {
  initial: {
    name: string
    phone: string
    dateOfBirth: string // YYYY-MM-DD or ''
  }
}

export function ProfileForm({ initial }: Props) {
  const t = useTranslations('me')
  const [state, setState] = useState<'idle' | 'saved' | 'error' | 'readonly'>('idle')
  const [isPending, startTransition] = useTransition()

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setState('idle')
    const form = new FormData(e.currentTarget)
    const payload = {
      name: String(form.get('name') ?? ''),
      phone: String(form.get('phone') ?? ''),
      dateOfBirth: String(form.get('dateOfBirth') ?? ''),
    }
    startTransition(async () => {
      const res = await updateProfile(payload)
      setState(res.ok ? 'saved' : 'error' in res && res.error === 'demo-readonly' ? 'readonly' : 'error')
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-[color:var(--color-text-muted)]">{t('name')}</span>
        <input
          type="text"
          name="name"
          required
          defaultValue={initial.name}
          className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-[color:var(--color-text)] outline-none transition focus:border-[color:var(--color-accent)]"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-[color:var(--color-text-muted)]">{t('phone')}</span>
        <input
          type="tel"
          name="phone"
          defaultValue={initial.phone}
          autoComplete="tel"
          className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-[color:var(--color-text)] outline-none transition focus:border-[color:var(--color-accent)]"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-[color:var(--color-text-muted)]">{t('dateOfBirth')}</span>
        <input
          type="date"
          name="dateOfBirth"
          defaultValue={initial.dateOfBirth}
          className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-[color:var(--color-text)] outline-none transition focus:border-[color:var(--color-accent)]"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-[color:var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)] disabled:opacity-60"
        >
          {isPending ? '…' : t('save')}
        </button>
        {state === 'saved' && (
          <span role="status" className="text-xs text-[color:var(--color-text-muted)]">{t('saved')}</span>
        )}
        {state === 'readonly' && (
          <span role="alert" className="text-xs text-[color:var(--color-accent-text)]">{t('demoReadonly')}</span>
        )}
        {state === 'error' && (
          <span role="alert" className="text-xs text-[color:var(--color-accent-text)]">{t('saveError')}</span>
        )}
      </div>
    </form>
  )
}
