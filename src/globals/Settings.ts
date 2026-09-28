import type { GlobalConfig } from 'payload'

import { anyone, isAdmin } from '../access/roles'

const DAYS = [
  { label: 'Monday', value: 'mon' },
  { label: 'Tuesday', value: 'tue' },
  { label: 'Wednesday', value: 'wed' },
  { label: 'Thursday', value: 'thu' },
  { label: 'Friday', value: 'fri' },
  { label: 'Saturday', value: 'sat' },
  { label: 'Sunday', value: 'sun' },
] as const

/**
 * Site-wide settings managed by admins.
 *
 * Everything that makes the site this gym's rather than a template lives
 * here: name, tagline, about text, contact details, default location and
 * the links to the gym's own terms and privacy policy. Opening hours drive
 * the visible hour range on the public schedule grid. Read through
 * lib/gymProfile.ts, which supplies neutral fallbacks for empty fields.
 *
 * Times are stored as `HH:mm` strings to keep them human-readable in the
 * database and trivial to render. Validation in code: range and ordering
 * happen on the schedule page, not at write time, so an admin can set a
 * placeholder while planning seasonal hours.
 */
export const Settings: GlobalConfig = {
  slug: 'settings',
  // Payload's edit locks live in a collection any signed-in user could
  // write over the API; one gym's admins do not need them.
  lockDocuments: false,
  label: 'Site Settings',
  access: {
    read: anyone, // Opening hours are public.
    update: isAdmin,
  },
  admin: {
    group: 'Configuration',
  },
  fields: [
    {
      name: 'gym',
      type: 'group',
      label: 'Gym details',
      admin: {
        description: 'Shown in the site header, footer, contact and about pages, and in emails.',
      },
      fields: [
        { name: 'name', type: 'text', required: true, defaultValue: 'Your Gym' },
        {
          name: 'tagline',
          type: 'text',
          localized: true,
          admin: { description: 'One line under the name in search results and link previews.' },
        },
        {
          name: 'about',
          type: 'textarea',
          localized: true,
          admin: { description: 'The body of the About page.' },
        },
        { name: 'contactEmail', type: 'email' },
        { name: 'contactPhone', type: 'text' },
        { name: 'address', type: 'textarea' },
        {
          name: 'defaultLocation',
          type: 'text',
          admin: {
            description:
              'Where classes take place unless a class says otherwise. Empty: the gym name is used.',
          },
        },
        {
          name: 'privacyUrl',
          type: 'text',
          admin: { description: 'Link to your privacy policy. The footer link only shows when set.' },
        },
        {
          name: 'termsUrl',
          type: 'text',
          admin: { description: 'Link to your terms. The footer link only shows when set.' },
        },
      ],
    },
    {
      name: 'openingHours',
      type: 'array',
      label: 'Opening hours',
      // Seven fixed rows, one per weekday. minRows/maxRows + defaultValue
      // give admins a pre-populated form they only need to tweak.
      minRows: 7,
      maxRows: 7,
      defaultValue: DAYS.map((d) => ({
        day: d.value,
        closed: d.value === 'sun',
        open: '09:00',
        close: '22:00',
      })),
      admin: {
        description:
          'These hours determine the time range shown on the public schedule grid.',
        initCollapsed: false,
      },
      fields: [
        {
          name: 'day',
          type: 'select',
          required: true,
          options: DAYS.map((d) => ({ label: d.label, value: d.value })),
          admin: { width: '25%' },
        },
        {
          name: 'closed',
          type: 'checkbox',
          defaultValue: false,
          label: 'Closed',
          admin: { width: '15%' },
        },
        {
          name: 'open',
          type: 'text',
          defaultValue: '09:00',
          admin: {
            width: '30%',
            description: 'HH:mm (24h)',
          },
        },
        {
          name: 'close',
          type: 'text',
          defaultValue: '22:00',
          admin: {
            width: '30%',
            description: 'HH:mm (24h)',
          },
        },
      ],
    },
  ],
}
