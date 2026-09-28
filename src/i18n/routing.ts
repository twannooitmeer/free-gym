import { defineRouting } from 'next-intl/routing'

/**
 * Locale routing for the public site.
 * - `nl` is the default locale.
 * - URLs are prefixed: `/nl/...` and `/en/...`. Hitting `/` redirects to the
 *   detected locale (Accept-Language) falling back to `nl`.
 *
 * The Payload admin lives under `/admin` (NOT prefixed) and is excluded by
 * the middleware matcher.
 */
export const routing = defineRouting({
  locales: ['nl', 'en'],
  defaultLocale: 'nl',
  localePrefix: 'always',
})

export type Locale = (typeof routing.locales)[number]
