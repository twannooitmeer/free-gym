import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/roles'

/**
 * Integrations: per-provider config for external booking/CRM systems.
 * v1 ships the schema and an admin UI, plus a stub provider for ClassPass.
 * Actual ClassPass sync is wired in v2 (see src/lib/integrations/).
 */
export const Integrations: CollectionConfig = {
  slug: 'integrations',
  // Payload's edit locks live in a collection any signed-in user could
  // write over the API; one gym's admins do not need them.
  lockDocuments: false,
  labels: {
    singular: 'Integration',
    plural: 'Integrations',
  },
  admin: {
    useAsTitle: 'name',
    group: 'Operations',
    defaultColumns: ['name', 'provider', 'enabled', 'lastSyncAt', 'lastSyncStatus'],
  },
  access: {
    create: isAdmin,
    read: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'provider',
      type: 'select',
      required: true,
      options: [
        { label: 'ClassPass (stub)', value: 'classpass' },
        { label: 'Custom / Other', value: 'custom' },
      ],
    },
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'config',
      type: 'json',
      admin: {
        description: 'Provider-specific configuration (API keys, studio id, etc.). Stored as JSON.',
      },
    },
    {
      name: 'lastSyncAt',
      type: 'date',
      admin: {
        readOnly: true,
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'lastSyncStatus',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
  ],
}
