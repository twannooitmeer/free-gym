import type { CollectionConfig } from 'payload'

import { anyone, isAdmin } from '../access/roles'

/**
 * SessionTypes: the categories shown in the schedule's type filter.
 * Seeded with kickboxing, personal training, sparring, etc.
 */
export const SessionTypes: CollectionConfig = {
  slug: 'session-types',
  // Payload's edit locks live in a collection any signed-in user could
  // write over the API; one gym's admins do not need them.
  lockDocuments: false,
  labels: {
    singular: 'Session Type',
    plural: 'Session Types',
  },
  admin: {
    useAsTitle: 'name',
    group: 'Schedule',
    defaultColumns: ['name', 'slug', 'color'],
  },
  access: {
    create: isAdmin,
    read: anyone,
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
    },
    {
      name: 'description',
      type: 'textarea',
      localized: true,
    },
    {
      name: 'color',
      type: 'text',
      defaultValue: '#dc2626',
      admin: {
        description: 'Color used to tag this type in the schedule.',
        components: {
          Field: '/components/admin/ColorField.tsx#ColorField',
        },
      },
    },
    {
      name: 'priceCents',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: {
        description:
          'Drop-in price in eurocents (e.g. 1500 = €15.00). Set to 0 for sessions that are always free.',
        step: 50,
      },
    },
    {
      name: 'coveredByMembership',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description:
          'When checked, active members (and trial members) pay nothing for this session. Drop-ins pay priceCents.',
      },
    },
  ],
}
