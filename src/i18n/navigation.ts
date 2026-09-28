import { createNavigation } from 'next-intl/navigation'

import { routing } from './routing'

/**
 * Locale-aware drop-in replacements for next/link, redirect, usePathname,
 * useRouter, and getPathname. Use these everywhere on the public site so
 * locale prefixing happens automatically.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
