'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'

import { getSession } from '@/lib/session'
import config from '@/payload.config'

type ProfileInput = {
  name?: string
  phone?: string
  dateOfBirth?: string // ISO date (YYYY-MM-DD) or empty
}

type ActionResult = { ok: true } | { ok: false; error: string }

/**
 * Customer updates their own profile. Limited to safe fields: name, phone,
 * dateOfBirth. Membership status and admin notes stay admin-only via the
 * collection's field-level access.
 */
export async function updateProfile(input: ProfileInput): Promise<ActionResult> {
  const session = await getSession()
  if (!session?.user) return { ok: false, error: 'not-authenticated' }
  if (session.user.role !== 'customers') return { ok: false, error: 'wrong-role' }

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  let customer
  try {
    customer = await payload.findByID({
      collection: 'customers',
      id: session.user.id,
      overrideAccess: true,
    })
  } catch {
    return { ok: false, error: 'customer-not-found' }
  }

  const data: Record<string, unknown> = {}
  if (typeof input.name === 'string' && input.name.trim().length > 0) {
    data.name = input.name.trim()
  }
  if (typeof input.phone === 'string') {
    data.phone = input.phone.trim() || null
  }
  if (typeof input.dateOfBirth === 'string') {
    data.dateOfBirth = input.dateOfBirth.trim() ? input.dateOfBirth : null
  }

  if (Object.keys(data).length === 0) return { ok: true }

  try {
    await payload.update({
      collection: 'customers',
      id: customer.id,
      // Customers have no API update access; this action writes only the
      // three fields assembled above.
      data,
      overrideAccess: true,
    })
  } catch {
    return { ok: false, error: 'failed' }
  }

  revalidatePath('/[locale]/me', 'page')
  return { ok: true }
}
