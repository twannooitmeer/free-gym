'use client'

import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'

import { checkInByCode } from '@/app/actions/checkIn'
import { useRouter } from '@/i18n/navigation'

export function CheckInButton({ code }: { code: string }) {
  const t = useTranslations('checkin')
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null)
            const res = await checkInByCode(code)
            if (!res.ok) {
              setError(t(`errors.${res.error}`))
              return
            }
            router.refresh()
          })
        }
        className="rounded-md bg-[color:var(--color-accent)] px-6 py-4 text-base font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)] disabled:opacity-60"
      >
        {isPending ? '…' : t('checkIn')}
      </button>
      {error && <p role="alert" className="text-sm text-[color:var(--color-accent-text)]">{error}</p>}
    </div>
  )
}
