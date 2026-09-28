'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'

import { cancelBooking } from '@/app/actions/cancelBooking'
import { useRouter } from '@/i18n/navigation'

export function CancelButton({ bookingId }: { bookingId: number | string }) {
  const t = useTranslations('me')
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const onClick = () => {
    setError(null)
    startTransition(async () => {
      const res = await cancelBooking(bookingId)
      if (!res.ok) {
        setError(res.error === 'not-cancellable' ? t('notCancellable') : t('cancelError'))
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="inline-flex min-h-11 items-center rounded-md border border-[color:var(--color-border)] px-3 text-sm font-medium text-[color:var(--color-text-muted)] transition hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-text)] disabled:opacity-60"
      >
        {isPending ? '…' : t('cancel')}
      </button>
      {error && <p role="alert" className="text-xs text-[color:var(--color-accent-text)]">{error}</p>}
    </div>
  )
}
