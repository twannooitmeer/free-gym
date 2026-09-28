'use client'

import { useTranslations } from 'next-intl'
import { useTransition } from 'react'

import { signOut } from '@/app/actions/auth'
import { useRouter } from '@/i18n/navigation'

export function SignOutButton() {
  const t = useTranslations('me')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await signOut()
          router.push('/')
          router.refresh()
        })
      }
      className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-md border border-[color:var(--color-border)] px-3 text-sm font-medium text-[color:var(--color-text-muted)] transition hover:border-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] disabled:opacity-60"
    >
      {t('signOut')}
    </button>
  )
}
