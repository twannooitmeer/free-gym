import { getLocale, getTranslations } from 'next-intl/server'

import { Link } from '@/i18n/navigation'
import { getGymProfile } from '@/lib/gymProfile'
import { getSession } from '@/lib/session'

import { HeaderNav } from './HeaderNav'

export async function SiteHeader() {
  const t = await getTranslations('nav')
  const session = await getSession()
  const gym = await getGymProfile(await getLocale())
  // The last word of the name gets the accent colour ("Your <Gym>").
  const words = gym.name.split(' ')
  const lead = words.length > 1 ? words.slice(0, -1).join(' ') + ' ' : ''
  const accent = words[words.length - 1]

  const account = !session?.user
    ? ({ href: '/login', label: t('login') } as const)
    : session.user.role === 'teachers'
      ? ({ href: '/teach', label: t('myClasses') } as const)
      : ({ href: '/me', label: t('myAccount') } as const)

  return (
    <header className="relative border-b border-[color:var(--color-border)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link
          href="/"
          aria-label={gym.name}
          className="display flex min-h-11 items-center text-2xl tracking-wider"
        >
          <span aria-hidden="true">
            {lead}
            <span className="text-[color:var(--color-accent)]">{accent}</span>
          </span>
        </Link>
        <HeaderNav account={account} />
      </div>
    </header>
  )
}
