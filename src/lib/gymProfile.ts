import { getPayload } from 'payload'
import { cache } from 'react'

import config from '@/payload.config'

export type GymProfile = {
  name: string
  tagline: string | null
  about: string | null
  contactEmail: string | null
  contactPhone: string | null
  address: string | null
  /** Where a class is when it does not say: the configured default, else the gym name. */
  defaultLocation: string
  privacyUrl: string | null
  termsUrl: string | null
}

const blank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null)

/** Only http(s) links reach the footer, so a typo cannot become a javascript: URL. */
const safeUrl = (v: string | null | undefined) => {
  const url = blank(v)
  return url && /^https?:\/\//i.test(url) ? url : null
}

/**
 * The gym's own details from Site Settings, with neutral fallbacks so a
 * fresh install renders sensibly before anyone opens the admin panel.
 * Memoised per request.
 */
export const getGymProfile = cache(async (locale: string = 'nl'): Promise<GymProfile> => {
  const payload = await getPayload({ config: await config })
  const settings = await payload.findGlobal({
    slug: 'settings',
    locale: locale === 'en' ? 'en' : 'nl',
    depth: 0,
    overrideAccess: true,
  })
  const gym = settings.gym ?? {}
  const name = blank(gym.name) ?? 'Your Gym'
  return {
    name,
    tagline: blank(gym.tagline),
    about: blank(gym.about),
    contactEmail: blank(gym.contactEmail),
    contactPhone: blank(gym.contactPhone),
    address: blank(gym.address),
    defaultLocation: blank(gym.defaultLocation) ?? name,
    privacyUrl: safeUrl(gym.privacyUrl),
    termsUrl: safeUrl(gym.termsUrl),
  }
})
