import type { Access, CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { isAdmin, isAdminField } from '../access/roles'

/**
 * Memberships: a customer's instance of a MembershipType.
 *
 * Owned end-to-end by the admin (purchase, activation, refunds). Customers
 * see their own memberships read-only via the /me portal.
 *
 * Credit accounting: for `credits` billing models, `creditsRemaining` is
 * decremented when a booking is created against this membership (see
 * confirmBooking action), and incremented back when the booking is
 * cancelled (see cancelBooking action). The hook below seeds the initial
 * `creditsRemaining` from the type's `creditsIncluded` on creation when
 * the admin hasn't set it explicitly.
 *
 * Expiry: when `endsAt` is set, the pricing logic treats the membership
 * as inactive once that date passes. `validityDays` on the type is used
 * to suggest `endsAt` automatically (see hook below) but admins can
 * override.
 */

const readMemberships: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.collection === 'admins') return true
  if (user.collection === 'customers') return { customer: { equals: user.id } }
  return false
}

const seedDefaults: CollectionBeforeChangeHook = async ({ data, operation, req, originalDoc }) => {
  if (operation !== 'create') return data

  // Resolve the linked MembershipType so we can seed credits + expiry.
  const typeId = data?.type ?? originalDoc?.type
  if (!typeId) return data

  try {
    const type = await req.payload.findByID({
      collection: 'membership-types',
      id: typeof typeId === 'object' ? typeId.id : typeId,
      depth: 0,
      req,
    })
    if (data.creditsRemaining == null && type?.billingModel === 'credits') {
      data.creditsRemaining = Number(type.creditsIncluded ?? 0)
    }
    if (!data.endsAt && type?.validityDays && data.startsAt) {
      const start = new Date(data.startsAt)
      const ends = new Date(start.getTime() + Number(type.validityDays) * 86_400_000)
      data.endsAt = ends.toISOString()
    }
  } catch {
    // Best-effort; admin can fill in manually.
  }
  return data
}

export const Memberships: CollectionConfig = {
  slug: 'memberships',
  // Payload's edit locks live in a collection any signed-in user could
  // write over the API; one gym's admins do not need them.
  lockDocuments: false,
  labels: {
    singular: 'Membership',
    plural: 'Memberships',
  },
  admin: {
    useAsTitle: 'id',
    group: 'Memberships',
    defaultColumns: ['customer', 'type', 'status', 'creditsRemaining', 'startsAt', 'endsAt'],
  },
  access: {
    read: readMemberships,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [seedDefaults],
  },
  fields: [
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      required: true,
      index: true,
    },
    {
      name: 'type',
      type: 'relationship',
      relationTo: 'membership-types',
      required: true,
      index: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Paused', value: 'paused' },
        { label: 'Expired', value: 'expired' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    },
    {
      name: 'startsAt',
      type: 'date',
      required: true,
      defaultValue: () => new Date().toISOString(),
    },
    {
      name: 'endsAt',
      type: 'date',
      admin: {
        description: 'Auto-filled from the type\'s validityDays when blank. Leave empty for no expiry.',
      },
    },
    {
      name: 'creditsRemaining',
      type: 'number',
      min: 0,
      admin: {
        description:
          'Remaining class credits. Auto-seeded from the type on creation for credit packs.',
      },
    },
    {
      name: 'paidAmountCents',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'What the customer actually paid for this membership (eurocents).',
      },
    },
    {
      name: 'paymentReference',
      type: 'text',
      admin: {
        description: 'Mollie/iDEAL/cash reference, etc.',
      },
      access: { read: isAdminField },
    },
    {
      name: 'notes',
      type: 'textarea',
      access: { read: isAdminField },
    },
  ],
}
