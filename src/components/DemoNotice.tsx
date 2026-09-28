import { getTranslations } from 'next-intl/server'

import { DEMO_CUSTOMER, DEMO_TEACHER, isDemoMode } from '@/lib/demo'

/** Shown on every page of a public demo (DEMO_MODE=1), nowhere else. */
export async function DemoNotice() {
  if (!isDemoMode()) return null
  const t = await getTranslations('demo')
  return (
    <aside
      aria-label={t('label')}
      className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] text-sm"
    >
      <div className="mx-auto max-w-6xl px-6 py-3 text-[color:var(--color-text-muted)]">
        <p>
          <strong className="font-semibold text-[color:var(--color-text)]">{t('title')}</strong>{' '}
          {t('body')}
        </p>
        <p className="mt-1">
          {t('member')}{' '}
          <code className="text-[color:var(--color-text)]">{DEMO_CUSTOMER.email}</code> /{' '}
          <code className="text-[color:var(--color-text)]">{DEMO_CUSTOMER.password}</code>
          {' · '}
          {t('teacher')}{' '}
          <code className="text-[color:var(--color-text)]">{DEMO_TEACHER.email}</code> /{' '}
          <code className="text-[color:var(--color-text)]">{DEMO_TEACHER.password}</code>
        </p>
      </div>
    </aside>
  )
}
