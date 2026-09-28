'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'

import { confirmBooking } from '@/app/actions/confirmBooking'
import { useRouter } from '@/i18n/navigation'

type Props = {
  sessionId: number | string
  /** When true the button label reads "Reserve and pay at the desk" instead of "Confirm". */
  requiresPayment: boolean
}

const KNOWN_ERRORS = [
  'full',
  'duplicate',
  'credits-changed',
  'started',
  'wrong-role',
  'not-authenticated',
  'unverified',
  'failed',
] as const

export function ConfirmBookingButton({ sessionId, requiresPayment }: Props) {
  const t = useTranslations('book')
  const tErr = useTranslations('schedule.bookErrors')
  const router = useRouter()
  const locale = useLocale() === 'en' ? 'en' : 'nl'
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const onClick = () => {
    setError(null)
    startTransition(async () => {
      const res = await confirmBooking(sessionId, locale)
      if (!res.ok) {
        // Codes without their own message (session gone, cancelled class)
        // fall back to the generic one instead of a missing-key error.
        const key = (KNOWN_ERRORS as readonly string[]).includes(res.error)
          ? (res.error as (typeof KNOWN_ERRORS)[number])
          : 'failed'
        setError(tErr(key))
        return
      }
      router.push(`/me/bookings/${res.bookingId}`)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="inline-flex items-center justify-center rounded-md bg-[color:var(--color-accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)] disabled:opacity-60"
      >
        {isPending ? '…' : requiresPayment ? t('reserveCta') : t('confirmCta')}
      </button>
      {error && <p className="text-xs text-[color:var(--color-accent)]">{error}</p>}
    </div>
  )
}
