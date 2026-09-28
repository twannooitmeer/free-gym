import createIntlMiddleware from 'next-intl/middleware'

import { routing } from '@/i18n/routing'

/**
 * Next.js proxy (formerly middleware): locale routing only. No route is gated at the edge: protected pages call
 * getSession() (lib/session.ts) server-side and redirect themselves. Keeping the
 * middleware minimal also avoids waking up the Node runtime for static
 * marketing pages.
 */
export default createIntlMiddleware(routing)

export const config = {
  // Match everything except:
  // - /admin/...      Payload admin panel (manages its own routing + auth)
  // - /api/...        all API routes (Payload REST, custom)
  // - /_next/...      Next.js internals
  // - any path with a file extension (favicon, images, etc.)
  matcher: ['/((?!api|admin|_next|_vercel|.*\\..*).*)'],
}
