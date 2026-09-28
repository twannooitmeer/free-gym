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
      className="text-xs font-medium text-[color:var(--color-text-muted)] underline-offset-4 hover:text-[color:var(--color-text)] hover:underline"
    >
      {t('signOut')}
    </button>
  )
}
