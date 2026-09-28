import { getLocale, getTranslations } from 'next-intl/server'

import { getGymProfile } from '@/lib/gymProfile'

export async function SiteFooter() {
  const t = await getTranslations('footer')
  const gym = await getGymProfile(await getLocale())
  return (
    <footer className="border-t border-[color:var(--color-border)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-[color:var(--color-text-muted)] md:flex-row md:items-center md:justify-between">
        <span>
          © {new Date().getFullYear()} {gym.name}, {t('rights')}.
        </span>
        {(gym.termsUrl || gym.privacyUrl) && (
          <div className="flex gap-6">
            {gym.termsUrl && (
              <a href={gym.termsUrl} className="hover:text-[color:var(--color-text)]">
                {t('terms')}
              </a>
            )}
            {gym.privacyUrl && (
              <a href={gym.privacyUrl} className="hover:text-[color:var(--color-text)]">
                {t('privacy')}
              </a>
            )}
          </div>
        )}
      </div>
    </footer>
  )
}
