import { getLocale, getTranslations } from 'next-intl/server'

import { getGymProfile } from '@/lib/gymProfile'
import { getSession } from '@/lib/session'
import { Link } from '@/i18n/navigation'

import { LocaleSwitch } from './LocaleSwitch'

export async function SiteHeader() {
  const t = await getTranslations('nav')
  const session = await getSession()
  const gym = await getGymProfile(await getLocale())
  // The last word of the name gets the accent colour ("Your <Gym>").
  const words = gym.name.split(' ')
  const lead = words.length > 1 ? words.slice(0, -1).join(' ') + ' ' : ''
  const accent = words[words.length - 1]
  const isLoggedIn = Boolean(session?.user)
  const isTeacher = session?.user?.role === 'teachers'
  const accountHref = isTeacher ? '/teach' : '/me'
  const accountLabel = isTeacher ? t('myClasses') : t('myAccount')

  return (
    <header className="border-b border-[color:var(--color-border)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="display text-2xl tracking-wider">
          {lead}
          <span className="text-[color:var(--color-accent)]">{accent}</span>
        </Link>

        <nav className="hidden gap-8 text-sm font-medium text-[color:var(--color-text-muted)] md:flex">
          <Link href="/schedule" className="transition hover:text-[color:var(--color-text)]">
            {t('schedule')}
          </Link>
          <Link href="/try-out" className="transition hover:text-[color:var(--color-text)]">
            {t('tryOut')}
          </Link>
          <Link href="/about" className="transition hover:text-[color:var(--color-text)]">
            {t('about')}
          </Link>
          <Link href="/contact" className="transition hover:text-[color:var(--color-text)]">
            {t('contact')}
          </Link>
        </nav>

        <div className="flex items-center gap-4 text-sm">
          <LocaleSwitch />
          {isLoggedIn ? (
            <Link
              href={accountHref}
              className="rounded-md border border-[color:var(--color-border)] px-3 py-1.5 font-medium transition hover:border-[color:var(--color-accent)]"
            >
              {accountLabel}
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-md border border-[color:var(--color-border)] px-3 py-1.5 font-medium transition hover:border-[color:var(--color-accent)]"
            >
              {t('login')}
            </Link>
          )}
          <Link
            href="/try-out"
            className="hidden rounded-md bg-[color:var(--color-accent)] px-4 py-1.5 font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)] md:inline-block"
          >
            {t('bookTrial')}
          </Link>
        </div>
      </div>
    </header>
  )
}
