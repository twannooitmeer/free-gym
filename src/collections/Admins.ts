import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/roles'
import { authOptions, STAFF_SESSION_SECONDS } from '../access/authOptions'

/**
 * Admins: full access to the Payload admin UI and all collections.
 * Created by other admins only (or via seed). No public registration.
 */
export const Admins: CollectionConfig = {
  slug: 'admins',
  // Payload's edit locks live in a collection any signed-in user could
  // write over the API; one gym's admins do not need them.
  lockDocuments: false,
  labels: {
    singular: 'Admin',
    plural: 'Admins',
  },
  admin: {
    useAsTitle: 'email',
    group: 'Identity',
  },
  auth: authOptions(STAFF_SESSION_SECONDS),
  access: {
    create: isAdmin,
    read: isAdmin,
    update: isAdmin,
    delete: isAdmin,
    admin: ({ req: { user } }) => user?.collection === 'admins',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
  ],
}
