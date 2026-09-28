import type { GlobalConfig } from 'payload'

import { anyone, isAdmin } from '../access/roles'

/**
 * Theme: admin-tunable visual tokens used by the public site.
 *
 * Kept separate from Settings so editors don't have to scroll past a wall
 * of color pickers when they just want to tweak opening hours. New visual
 * knobs (button colors, accent overrides, etc.) live here.
 *
 * All values are `#rrggbb` strings and get inlined as inline styles on the
 * relevant elements. The fields use the same ColorField picker as
 * SessionTypes.color so admins get a native swatch + hex input.
 */
export const Theme: GlobalConfig = {
  slug: 'theme',
  // Payload's edit locks live in a collection any signed-in user could
  // write over the API; one gym's admins do not need them.
  lockDocuments: false,
  label: 'Theme',
  access: {
    read: anyone, // Public so the schedule grid can read it without auth.
    update: isAdmin,
  },
  admin: {
    group: 'Configuration',
  },
  fields: [
    {
      type: 'collapsible',
      label: 'Schedule session colors',
      admin: {
        description:
          'Background colors used for the session cards on the public schedule.',
      },
      fields: [
        {
          name: 'scheduleSessionPast',
          type: 'text',
          label: 'Past sessions',
          defaultValue: '#141414',
          admin: {
            description: 'Sessions that have already finished.',
            components: {
              Field: '/components/admin/ColorField.tsx#ColorField',
            },
          },
        },
        {
          name: 'scheduleSessionFuture',
          type: 'text',
          label: 'Future sessions (not booked)',
          defaultValue: '#262626',
          admin: {
            description: 'Upcoming sessions the viewer can still book.',
            components: {
              Field: '/components/admin/ColorField.tsx#ColorField',
            },
          },
        },
        {
          name: 'scheduleSessionBooked',
          type: 'text',
          label: 'Future sessions (booked)',
          defaultValue: '#3d1414',
          admin: {
            description:
              'Upcoming sessions the signed-in customer has already booked.',
            components: {
              Field: '/components/admin/ColorField.tsx#ColorField',
            },
          },
        },
      ],
    },
  ],
}
