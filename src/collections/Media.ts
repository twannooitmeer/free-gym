import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/roles'

/**
 * Uploaded images (teacher avatars). Public to read; only admins upload,
 * change or delete. Without explicit create access Payload lets any
 * signed-in user upload, which here includes every self-registered member.
 * Files are stored in ./media (a volume in docker-compose.yml).
 */
export const Media: CollectionConfig = {
  slug: 'media',
  // Payload's edit locks live in a collection any signed-in user could
  // write over the API; one gym's admins do not need them.
  lockDocuments: false,
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: true,
}
