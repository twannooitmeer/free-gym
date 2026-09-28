import type { CollectionAfterChangeHook, CollectionConfig } from 'payload'

import { anyone, isAdmin } from '../access/roles'
import { materializeSeries } from '../lib/materialize'

/**
 * SessionSeries: a recurring class template.
 *
 * The materializer (see `lib/materialize.ts`) reads the recurrence rule
 * and creates concrete `Sessions` rows up to `horizonWeeks` ahead. It is
 * idempotent and skips dates where a Session already exists for this
 * series, so admin-side overrides survive re-runs.
 *
 * Triggering:
 * - Materialization runs automatically on every save of a series
 *   (afterChange hook). For v1 that's enough; a daily cron lands when we
 *   deploy.
 * - There is no "delete a series" cleanup of materialized sessions on
 *   purpose. If you want to wipe future instances, delete them manually
 *   or use `skipDates` + re-materialize.
 */

const runMaterializer: CollectionAfterChangeHook = async ({ doc, req, operation }) => {
  if (operation !== 'create' && operation !== 'update') return doc
  try {
    await materializeSeries(req.payload, doc, req)
  } catch (err) {
    req.payload.logger.error({ msg: 'materializeSeries failed', err, seriesId: doc.id })
  }
  return doc
}

export const SessionSeries: CollectionConfig = {
  slug: 'session-series',
  // Payload's edit locks live in a collection any signed-in user could
  // write over the API; one gym's admins do not need them.
  lockDocuments: false,
  labels: {
    singular: 'Session Series',
    plural: 'Session Series',
  },
  admin: {
    useAsTitle: 'name',
    group: 'Schedule',
    defaultColumns: ['name', 'type', 'teacher', 'startTime', 'horizonWeeks', 'active'],
    description:
      'Recurring class templates. Materialize concrete sessions up to the horizon on every save.',
  },
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    afterChange: [runMaterializer],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Internal label, e.g. "Mon/Wed Kickboxing 18:00".',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Uncheck to stop materializing new sessions. Existing rows are untouched.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'type',
          type: 'relationship',
          relationTo: 'session-types',
          required: true,
          admin: { width: '50%' },
        },
        {
          name: 'teacher',
          type: 'relationship',
          relationTo: 'teachers',
          required: true,
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'title',
      type: 'text',
      localized: true,
      admin: {
        description:
          'Optional display title used on each materialized session. Falls back to the type name.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'startTime',
          type: 'text',
          required: true,
          defaultValue: '18:00',
          admin: {
            width: '33%',
            description: 'Local time in HH:mm (24h). The gym timezone is Europe/Amsterdam.',
            placeholder: '18:00',
          },
          validate: (value: unknown) => {
            if (typeof value !== 'string') return 'Required'
            return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) || 'Use HH:mm (e.g. 18:00)'
          },
        },
        {
          name: 'durationMinutes',
          type: 'number',
          required: true,
          defaultValue: 60,
          min: 5,
          max: 240,
          admin: { width: '33%' },
        },
        {
          name: 'capacity',
          type: 'number',
          required: true,
          defaultValue: 16,
          min: 1,
          admin: { width: '33%' },
        },
      ],
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
    // ── Recurrence ─────────────────────────────────────────────────────
    {
      name: 'frequency',
      type: 'select',
      required: true,
      defaultValue: 'weekly',
      options: [{ label: 'Weekly', value: 'weekly' }],
      admin: {
        description: 'Only weekly for now. Monthly/yearly can land later if needed.',
      },
    },
    {
      name: 'daysOfWeek',
      type: 'select',
      hasMany: true,
      required: true,
      options: [
        { label: 'Mon', value: 'mon' },
        { label: 'Tue', value: 'tue' },
        { label: 'Wed', value: 'wed' },
        { label: 'Thu', value: 'thu' },
        { label: 'Fri', value: 'fri' },
        { label: 'Sat', value: 'sat' },
        { label: 'Sun', value: 'sun' },
      ],
    },
    {
      name: 'interval',
      type: 'number',
      defaultValue: 1,
      min: 1,
      admin: {
        description: 'Every N weeks. 1 = every week, 2 = every other week.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'startsOn',
          type: 'date',
          required: true,
          defaultValue: () => new Date().toISOString(),
          admin: {
            width: '50%',
            date: { pickerAppearance: 'dayOnly' },
            description: 'First date the series is allowed to produce a session.',
          },
        },
        {
          name: 'endsOn',
          type: 'date',
          admin: {
            width: '50%',
            date: { pickerAppearance: 'dayOnly' },
            description: 'Leave empty for indefinite. Materialization always caps at the horizon.',
          },
        },
      ],
    },
    {
      name: 'skipDates',
      type: 'array',
      admin: {
        description:
          'Dates to skip (holidays, gym closures). Materializer will not create sessions on these days.',
      },
      fields: [
        {
          name: 'date',
          type: 'date',
          required: true,
          admin: { date: { pickerAppearance: 'dayOnly' } },
        },
        {
          name: 'reason',
          type: 'text',
        },
      ],
    },
    {
      name: 'horizonWeeks',
      type: 'number',
      defaultValue: 8,
      min: 1,
      max: 52,
      admin: {
        description: 'How many weeks ahead to materialize on each save.',
      },
    },
  ],
}
