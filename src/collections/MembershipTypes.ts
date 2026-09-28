import type { CollectionConfig } from 'payload'

import { anyone, isAdmin } from '../access/roles'

/**
 * MembershipTypes: the catalog of memberships and packs the gym sells.
 *
 * Three billing models are supported:
 * - `unlimited`: covers any (matching) class for the duration of the
 *   membership. Used for "all-access pass". No credit tracking.
 * - `credits`: a pack of N reservations (e.g. 10-strip stampcard). Each
 *   booking that uses this membership decrements `creditsRemaining` on
 *   the per-customer Memberships row.
 * - `period`: an unlimited pass that is time-bounded (e.g. monthly,
 *   yearly). Functionally the same as `unlimited` at booking time but
 *   admins use the distinction to drive renewals later.
 *
 * Coverage rules:
 * - When `coversAllTypes` is true, this membership applies to any
 *   SessionType regardless of which types are linked.
 * - When false, only sessions whose `type` is in `includedTypes` are
 *   covered. Anything else falls back to drop-in pricing.
 */
export const MembershipTypes: CollectionConfig = {
  slug: 'membership-types',
  // Payload's edit locks live in a collection any signed-in user could
  // write over the API; one gym's admins do not need them.
  lockDocuments: false,
  labels: {
    singular: 'Membership Type',
    plural: 'Membership Types',
  },
  admin: {
    useAsTitle: 'name',
    group: 'Memberships',
    defaultColumns: ['name', 'billingModel', 'priceCents', 'active'],
  },
  access: {
    // Public list/read so the marketing site can render pricing later.
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      localized: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Stable identifier (e.g. "all-access", "10-strip-card"). Lowercase, hyphens.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      localized: true,
    },
    {
      name: 'billingModel',
      type: 'select',
      required: true,
      defaultValue: 'unlimited',
      options: [
        { label: 'Unlimited (all-access pass)', value: 'unlimited' },
        { label: 'Credits (stampcard / pack)', value: 'credits' },
        { label: 'Period (time-limited unlimited)', value: 'period' },
      ],
    },
    {
      name: 'priceCents',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: {
        step: 50,
        description: 'Purchase price in eurocents (e.g. 12500 = €125,00).',
      },
    },
    {
      name: 'creditsIncluded',
      type: 'number',
      min: 0,
      admin: {
        condition: (data) => data?.billingModel === 'credits',
        description: 'Number of class credits this pack contains.',
      },
    },
    {
      name: 'validityDays',
      type: 'number',
      min: 0,
      admin: {
        description:
          'How many days the membership stays valid after activation. Leave empty for no expiry.',
      },
    },
    {
      name: 'coversAllTypes',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'When checked, this membership applies to every session type.',
      },
    },
    {
      name: 'includedTypes',
      type: 'relationship',
      relationTo: 'session-types',
      hasMany: true,
      admin: {
        condition: (data) => !data?.coversAllTypes,
        description: 'Restrict coverage to only these session types.',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Uncheck to hide from new purchases without deleting historical data.',
      },
    },
  ],
}
