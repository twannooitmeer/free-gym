'use client'

import { useLocale } from 'next-intl'
import { useTransition } from 'react'

import { usePathname, useRouter } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

/**
 * Compact two-letter language switch. Preserves the current path when toggling.
 * Client component because it triggers navigation on user interaction.
 *
 * Note: none of our public routes have dynamic segments yet, so we pass the
 * raw pathname through. If we later add `/[locale]/schedule/[sessionId]` we
 * need to forward `useParams()` to `router.replace`.
 */
export function LocaleSwitch() {
  const current = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const onSelect = (next: string) => {
    if (next === current) return
    startTransition(() => {
      router.replace(pathname, { locale: next as 'nl' | 'en' })
    })
  }

  return (
    <div
      className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider"
      aria-busy={isPending}
    >
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => onSelect(loc)}
          className={
            loc === current
              ? 'text-[color:var(--color-text)]'
              : 'text-[color:var(--color-text-dim)] transition hover:text-[color:var(--color-text-muted)]'
          }
          aria-current={loc === current ? 'true' : undefined}
        >
          {loc}
        </button>
      ))}
    </div>
  )
}
