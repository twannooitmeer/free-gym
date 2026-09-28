import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { anyone, isAdmin } from '../access/roles'

/**
 * Sessions: individual scheduled class instances.
 *
 * Each row is a single occurrence. A Session may be standalone (created
 * by hand) or `series`-linked (produced by the SessionSeries materializer).
 *
 * Override semantics:
 * - When an admin edits a series-linked Session, the beforeChange hook
 *   below flips `seriesOverride` to true. The materializer will then
 *   leave it alone on subsequent re-runs, so admins can safely swap a
 *   sub teacher or move a single class without losing their change.
 *
 * Cancellation:
 * - Soft cancel via `status: 'cancelled'`. The schedule view and the
 *   /book flow both hide / refuse cancelled sessions. Cancellation also
 *   needs an admin-side notification path (TODO).
 */

const markOverride: CollectionBeforeChangeHook = ({ data, originalDoc, operation }) => {
  if (operation !== 'update') return data
  if (!originalDoc?.series) return data
  if (data?.seriesOverride) return data
  // Detect meaningful changes that should freeze this row from re-materialization.
  const tracked = [
    'title',
    'type',
    'teacher',
    'startsAt',
    'durationMinutes',
    'capacity',
    'location',
    'description',
    'status',
  ] as const
  for (const k of tracked) {
    const next = (data as Record<string, unknown>)[k]
    const prev = (originalDoc as Record<string, unknown>)[k]
    if (next !== undefined && next !== prev) {
      ;(data as Record<string, unknown>).seriesOverride = true
      break
    }
  }
  return data
}

export const Sessions: CollectionConfig = {
  slug: 'sessions',
  // Payload's edit locks live in a collection any signed-in user could
  // write over the API; one gym's admins do not need them.
  lockDocuments: false,
  labels: {
    singular: 'Session',
    plural: 'Sessions',
  },
  admin: {
    useAsTitle: 'title',
    group: 'Schedule',
    defaultColumns: ['title', 'type', 'teacher', 'startsAt', 'status', 'capacity'],
    pagination: {
      defaultLimit: 50,
    },
  },
  access: {
    // Schedule is public so visitors see classes before signing up.
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [markOverride],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      localized: true,
      admin: {
        description: 'Optional display title. Falls back to the session type name when empty.',
      },
    },
    {
      name: 'type',
      type: 'relationship',
      relationTo: 'session-types',
      required: true,
      hasMany: false,
      index: true,
    },
    {
      name: 'teacher',
      type: 'relationship',
      relationTo: 'teachers',
      required: true,
      hasMany: false,
      index: true,
    },
    {
      name: 'startsAt',
      type: 'date',
      required: true,
      index: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
          timeFormat: 'HH:mm',
        },
      },
    },
    {
      name: 'durationMinutes',
      type: 'number',
      required: true,
      defaultValue: 60,
      min: 5,
      max: 240,
    },
    {
      name: 'capacity',
      type: 'number',
      required: true,
      defaultValue: 16,
      min: 1,
    },
    {
      name: 'location',
      type: 'text',
      admin: {
        description: "Leave empty to use the default location from Site Settings.",
      },
    },
    {
      name: 'description',
      type: 'textarea',
      localized: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'scheduled',
      options: [
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      admin: {
        description:
          'Cancelled sessions are hidden from the public schedule and cannot be booked. Booked customers should be notified manually for now.',
      },
    },
    // ── Series link (only set when produced by the materializer) ───────
    {
      name: 'series',
      type: 'relationship',
      relationTo: 'session-series',
      index: true,
      admin: {
        readOnly: true,
        description: 'Set automatically when this session is generated from a recurring series.',
      },
    },
    {
      name: 'seriesOverride',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Auto-set to true when an admin edits a series-generated session. The series materializer will then leave this row alone.',
      },
    },
  ],
}
