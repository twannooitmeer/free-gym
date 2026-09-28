'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useId, useState } from 'react'

import { Link, usePathname } from '@/i18n/navigation'

import { LocaleSwitch } from './LocaleSwitch'

const LINKS = [
  { href: '/schedule', key: 'schedule' },
  { href: '/try-out', key: 'tryOut' },
  { href: '/about', key: 'about' },
  { href: '/contact', key: 'contact' },
] as const

type Account = { href: '/me' | '/teach' | '/login'; label: string }

/**
 * The header's navigation: inline links from md up, a menu button below
 * that. The current page is marked (aria-current and colour). The menu
 * closes on navigation and on Escape, and returns focus to its button.
 */
export function HeaderNav({ account }: { account: Account }) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const menuId = useId()

  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      document.getElementById(`${menuId}-button`)?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, menuId])

  const linkClass = (href: string) =>
    isCurrent(href)
      ? 'text-[color:var(--color-text)]'
      : 'text-[color:var(--color-text-muted)] transition hover:text-[color:var(--color-text)]'

  return (
    <>
      <nav aria-label={t('main')} className="hidden gap-8 text-sm font-medium md:flex">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isCurrent(l.href) ? 'page' : undefined}
            className={`py-3 ${linkClass(l.href)}`}
          >
            {t(l.key)}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-2 text-sm md:gap-4">
        <div className="hidden md:block">
          <LocaleSwitch />
        </div>
        <Link
          href={account.href}
          className="inline-flex min-h-11 items-center rounded-md border border-[color:var(--color-border)] px-3 font-medium transition hover:border-[color:var(--color-accent)]"
        >
          {account.label}
        </Link>
        <Link
          href="/try-out"
          className="hidden min-h-11 items-center rounded-md bg-[color:var(--color-accent)] px-4 font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)] md:inline-flex"
        >
          {t('bookTrial')}
        </Link>
        <button
          id={`${menuId}-button`}
          type="button"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex size-11 items-center justify-center rounded-md border border-[color:var(--color-border)] md:hidden"
        >
          <span className="sr-only">{open ? t('closeMenu') : t('openMenu')}</span>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {open && (
        <div
          id={menuId}
          className="absolute inset-x-0 top-full z-40 border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)] md:hidden"
        >
          <nav aria-label={t('main')} className="mx-auto flex max-w-6xl flex-col px-6 py-2">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                aria-current={isCurrent(l.href) ? 'page' : undefined}
                className={`flex min-h-12 items-center border-b border-[color:var(--color-border)] text-base font-medium last:border-b-0 ${linkClass(l.href)}`}
              >
                {t(l.key)}
              </Link>
            ))}
          </nav>
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 pb-5 pt-2">
            <LocaleSwitch />
            <Link
              href="/try-out"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-11 items-center rounded-md bg-[color:var(--color-accent)] px-4 text-sm font-semibold text-white"
            >
              {t('bookTrial')}
            </Link>
          </div>
        </div>
      )}
    </>
  )
}
