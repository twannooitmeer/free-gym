import type { CollectionConfig } from 'payload'

import { isAdmin, isAdminField, isAdminOrSelf, isAdminOrSelfField, onlyAdminsCreateOverApi } from '../access/roles'
import { authOptions, MEMBER_SESSION_SECONDS } from '../access/authOptions'

/**
 * Customers: gym members and prospects.
 * - Customers never write this collection through the API: signing up and
 *   editing the profile go through server actions (signupCustomer,
 *   updateProfile) that write only the fields a customer may set. Over the
 *   API a customer could otherwise sign up as verified or 'active', or
 *   change their email and stay verified.
 * - A customer can read their own profile.
 * - Teachers cannot list customers, but they CAN see the `name` field of customers
 *   who appear in their session rosters (via Bookings populate). Email and phone
 *   are admin/self-only at the field level so teachers never see contact details.
 */
export const Customers: CollectionConfig = {
  slug: 'customers',
  // Payload's edit locks live in a collection any signed-in user could
  // write over the API; one gym's admins do not need them.
  lockDocuments: false,
  labels: {
    singular: 'Customer',
    plural: 'Customers',
  },
  admin: {
    useAsTitle: 'email',
    group: 'Identity',
    defaultColumns: ['name', 'email', 'membershipStatus', 'createdAt'],
  },
  auth: authOptions(MEMBER_SESSION_SECONDS),
  hooks: {
    beforeOperation: [onlyAdminsCreateOverApi],
  },
  access: {
    create: isAdmin,
    read: isAdminOrSelf('customers'),
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
      name: 'phone',
      type: 'text',
      access: {
        read: isAdminOrSelfField('customers'),
      },
    },
    {
      name: 'dateOfBirth',
      type: 'date',
      access: {
        read: isAdminOrSelfField('customers'),
      },
    },
    {
      name: 'membershipStatus',
      type: 'select',
      defaultValue: 'none',
      options: [
        { label: 'None', value: 'none' },
        { label: 'Trial', value: 'trial' },
        { label: 'Active', value: 'active' },
        { label: 'Paused', value: 'paused' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      access: {
        update: isAdminField,
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Internal notes about this customer. Admin-only.',
      },
      access: {
        read: isAdminField,
        update: isAdminField,
      },
    },
    // ---------- email verification ----------
    // Customers must verify their email (6-digit code) before they can
    // book. The check happens in /book and confirmBooking; admins can
    // flip emailVerified manually if a code goes astray.
    {
      name: 'emailVerified',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Set automatically when the customer enters their verification code.',
        position: 'sidebar',
      },
      access: {
        update: isAdminField,
      },
    },
    // The remaining fields are internal: hidden in the admin UI and not
    // exposed via the REST/GraphQL API. Our server actions use
    // overrideAccess so they can still read/write them.
    {
      name: 'verificationCode',
      type: 'text',
      admin: { hidden: true },
      access: { read: () => false, update: () => false },
    },
    {
      name: 'verificationExpiresAt',
      type: 'date',
      admin: { hidden: true },
      access: { read: () => false, update: () => false },
    },
    {
      name: 'verificationAttempts',
      type: 'number',
      defaultValue: 0,
      admin: { hidden: true },
      access: { read: () => false, update: () => false },
    },
    {
      name: 'verificationSentAt',
      type: 'date',
      admin: { hidden: true },
      access: { read: () => false, update: () => false },
    },
  ],
}
