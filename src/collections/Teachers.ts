import type { CollectionConfig } from 'payload'

import {
  isAdmin,
  isAdminField,
  isAdminOrSelf,
  onlyAdminsChangeEmail,
  onlyAdminsCreateOverApi,
} from '../access/roles'
import { authOptions, MEMBER_SESSION_SECONDS } from '../access/authOptions'

/**
 * Teachers: gym staff who run sessions.
 * - Created by admins only.
 * - Can read their own profile + update a limited subset (handled at the field level).
 * - Other teachers and customers do not need direct access to the teachers collection;
 *   teacher info is exposed through the public Sessions feed (name + bio only).
 */
export const Teachers: CollectionConfig = {
  slug: 'teachers',
  // Payload's edit locks live in a collection any signed-in user could
  // write over the API; one gym's admins do not need them.
  lockDocuments: false,
  labels: {
    singular: 'Teacher',
    plural: 'Teachers',
  },
  admin: {
    useAsTitle: 'name',
    group: 'Identity',
    defaultColumns: ['name', 'email', 'active'],
  },
  auth: authOptions(MEMBER_SESSION_SECONDS),
  hooks: {
    beforeOperation: [onlyAdminsCreateOverApi],
    beforeChange: [onlyAdminsChangeEmail],
  },
  access: {
    create: isAdmin,
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.collection === 'admins') return true
      // A teacher can see their own record. Customers and other teachers read
      // teacher info through the (publicly readable) Sessions collection.
      if (user.collection === 'teachers') return { id: { equals: user.id } }
      return false
    },
    update: isAdminOrSelf('teachers'),
    delete: isAdmin,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'bio',
      type: 'textarea',
    },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      access: {
        update: isAdminField,
      },
    },
  ],
}
