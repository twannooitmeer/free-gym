import type { GlobalConfig } from 'payload'

import { invalidateEmailConfig } from '../lib/emailConfig'
import { isAdmin } from '../access/roles'

/**
 * Email: transactional email provider configuration.
 *
 * Kept separate from Settings/Theme because it contains a secret
 * (`apiKey`) that must never be exposed to public reads. The whole
 * global is admin-only, neither anonymous visitors nor customers can
 * read it.
 *
 * Values fall back to env vars (RESEND_API_KEY, EMAIL_FROM) when the
 * global hasn't been filled in yet, so local dev keeps working without
 * touching the admin.
 *
 * Future-proofing: `provider` is a select so adding SendGrid/Postmark
 * later is just a new enum value + a branch in src/lib/email.ts.
 */
export const Email: GlobalConfig = {
  slug: 'email',
  // Payload's edit locks live in a collection any signed-in user could
  // write over the API; one gym's admins do not need them.
  lockDocuments: false,
  label: 'Email',
  access: {
    // Hard-locked. The API key in here would let anyone send mail
    // as the gym, so we never expose this global to non-admins.
    read: isAdmin,
    update: isAdmin,
  },
  admin: {
    group: 'Configuration',
    description:
      'Transactional email provider used for signup verification and booking confirmations.',
  },
  hooks: {
    // Drop the in-memory config cache so admin edits take effect on the
    // very next sendEmail() call, no restart required.
    afterChange: [
      () => {
        invalidateEmailConfig()
      },
    ],
  },
  fields: [
    {
      name: 'provider',
      type: 'select',
      required: true,
      defaultValue: 'resend',
      options: [
        { label: 'Resend', value: 'resend' },
        // Stub for the future. Wire-up lives in src/lib/email.ts.
        { label: 'SendGrid (coming soon)', value: 'sendgrid' },
      ],
      admin: {
        description: 'Which HTTPS email API to use. Only Resend is wired up today.',
      },
    },
    {
      name: 'fromAddress',
      type: 'text',
      label: 'From address',
      admin: {
        description:
          'Verified sender, e.g. "Your Gym <hello@mail.example.com>". Must match a verified domain in the provider.',
      },
    },
    {
      name: 'apiKey',
      type: 'text',
      label: 'API key',
      admin: {
        description:
          'Stored in the database in plain text. Treat the admin panel as sensitive.',
      },
    },
    {
      name: 'verificationRequired',
      type: 'checkbox',
      label: 'Require email verification before booking',
      defaultValue: false,
      admin: {
        description:
          'When enabled, new customers receive a 6-digit code by email and must enter it before they can book. Can only be enabled once both From address and API key are filled in.',
      },
      // Refuse to enable verification without a working sender. Avoids
      // the failure mode where admins turn it on, signups silently fail,
      // and nobody can register.
      validate: ((value: unknown, args: { siblingData?: unknown }) => {
        if (value !== true) return true
        const sib = (args.siblingData ?? {}) as {
          fromAddress?: string | null
          apiKey?: string | null
        }
        const hasFrom = typeof sib.fromAddress === 'string' && sib.fromAddress.trim() !== ''
        const hasKey = typeof sib.apiKey === 'string' && sib.apiKey.trim() !== ''
        if (!hasFrom || !hasKey) {
          return 'Set both From address and API key before enabling email verification.'
        }
        return true
      }) as unknown as undefined,
    },
  ],
}
