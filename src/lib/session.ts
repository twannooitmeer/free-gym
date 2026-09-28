import { headers } from 'next/headers'
import { getPayload } from 'payload'
import { cache } from 'react'

import config from '@/payload.config'

export type SessionRole = 'customers' | 'teachers'

export type Session = {
  user: { id: string; role: SessionRole; email: string; name?: string }
}

/**
 * The signed-in customer or teacher, read from Payload's own HTTP-only
 * session cookie. There is one auth system: the public site and /admin
 * both use Payload auth, so there is no second secret, session store or
 * beta dependency to keep in step.
 *
 * Admins are not a site session (they use /admin); for the public pages
 * an admin cookie reads as signed out. One browser holds one Payload
 * session at a time, so signing in on the site replaces an admin session
 * in the same browser and vice versa.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const payload = await getPayload({ config: await config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) return null
  if (user.collection !== 'customers' && user.collection !== 'teachers') return null
  return {
    user: {
      id: String(user.id),
      role: user.collection,
      email: user.email,
      name: 'name' in user ? (user.name ?? undefined) : undefined,
    },
  }
})

export type StaffUser = { id: string; collection: 'admins' | 'teachers'; name?: string }

/**
 * An admin (signed in via /admin) or a teacher (signed in on the site),
 * for staff-only pages such as check-in. Unlike getSession, admins count.
 */
export const getStaffUser = cache(async (): Promise<StaffUser | null> => {
  const payload = await getPayload({ config: await config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) return null
  if (user.collection !== 'admins' && user.collection !== 'teachers') return null
  return {
    id: String(user.id),
    collection: user.collection,
    name: 'name' in user ? (user.name ?? undefined) : undefined,
  }
})
