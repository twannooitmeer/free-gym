import type {
  Access,
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
  FieldAccess,
  Where,
} from 'payload'

import { isAdmin } from '../access/roles'
import { lockSessionSeats } from '../lib/db'
import { CANCELLED_STATUS, generateCheckInCode, hasFreeSeat, holdsSeat } from '../lib/scheduling'

/**
 * Bookings: link a customer to a scheduled session.
 *
 * Access model:
 * - Only admins write through the API. Customers book and cancel through
 *   the booking service, which runs as them with overrideAccess after its
 *   own checks; the beforeValidate hook still forces `customer` to the
 *   signed-in customer on those creates.
 * - Customers see their own bookings; admins see all.
 * - Teachers see bookings whose session.teacher is themselves. They get the
 *   customer NAME via populate, but not contact details (enforced at the
 *   Customers collection field level).
 *
 * Integrity: see lib/scheduling/bookings.ts. The duplicate rule is a
 * partial unique index; the capacity rule is checked here while holding a
 * per-session lock, so it is correct under concurrent requests. Every read
 * passes `req` so it runs inside this operation's transaction.
 */

const enforceOwnershipAndCapacity: CollectionBeforeValidateHook = async ({
  data,
  req,
  operation,
  originalDoc,
}) => {
  const user = req.user
  if (!data) return data

  // For self-service creates, customers can only book themselves.
  if (operation === 'create' && user?.collection === 'customers') {
    if (data.customer && data.customer !== user.id) {
      throw new Error('Customers can only create bookings for themselves.')
    }
    data.customer = user.id
    data.source = data.source ?? 'web'
  }

  const sessionId = data.session ?? originalDoc?.session
  const customerId = data.customer ?? originalDoc?.customer
  if (!sessionId || !customerId) return data

  const status = data.status ?? originalDoc?.status ?? 'confirmed'
  if (!holdsSeat(status)) return data

  const sessionKey = typeof sessionId === 'object' ? sessionId.id : sessionId
  const customerKey = typeof customerId === 'object' ? customerId.id : customerId
  const selfId = operation === 'update' ? originalDoc?.id : undefined

  // Until this transaction ends, any other booking for this session waits
  // here, so the checks below read a count nobody else can change.
  await lockSessionSeats(req, sessionKey)

  const notSelf: Where[] = selfId ? [{ id: { not_equals: selfId } }] : []

  const duplicate = await req.payload.count({
    collection: 'bookings',
    where: {
      and: [
        { customer: { equals: customerKey } },
        { session: { equals: sessionKey } },
        { status: { not_equals: CANCELLED_STATUS } },
        ...notSelf,
      ],
    },
    req,
  })
  if (duplicate.totalDocs > 0) {
    throw new Error('This customer already has a booking for this session.')
  }

  const session = await req.payload.findByID({
    collection: 'sessions',
    id: sessionKey,
    depth: 0,
    req,
  })
  const held = await req.payload.count({
    collection: 'bookings',
    where: {
      and: [
        { session: { equals: sessionKey } },
        { status: { not_equals: CANCELLED_STATUS } },
        ...notSelf,
      ],
    },
    req,
  })
  if (!hasFreeSeat(session?.capacity, held.totalDocs)) {
    throw new Error('This session is fully booked.')
  }

  return data
}

/** Every booking gets its own check-in code when it is created; it never changes. */
const assignCheckInCode: CollectionBeforeChangeHook = ({ data, operation }) => {
  if (operation === 'create') data.checkInCode = generateCheckInCode()
  return data
}

/**
 * The code is what gets someone checked in, so only the admin and the
 * customer who owns the booking may read it; teachers see the roster
 * without codes.
 */
const readCheckInCode: FieldAccess = ({ req: { user }, doc }) => {
  if (!user) return false
  if (user.collection === 'admins') return true
  if (user.collection !== 'customers' || !doc) return false
  const owner = typeof doc.customer === 'object' ? doc.customer?.id : doc.customer
  return String(owner) === String(user.id)
}

const readBookings: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.collection === 'admins') return true
  if (user.collection === 'customers') {
    const where: Where = { customer: { equals: user.id } }
    return where
  }
  if (user.collection === 'teachers') {
    // Bookings for sessions taught by this teacher.
    const where: Where = { 'session.teacher': { equals: user.id } }
    return where
  }
  return false
}

export const Bookings: CollectionConfig = {
  slug: 'bookings',
  // Payload's edit locks live in a collection any signed-in user could
  // write over the API; one gym's admins do not need them.
  lockDocuments: false,
  labels: {
    singular: 'Booking',
    plural: 'Bookings',
  },
  admin: {
    useAsTitle: 'id',
    group: 'Schedule',
    defaultColumns: ['customer', 'session', 'status', 'source', 'createdAt'],
  },
  access: {
    // Customers book and cancel only through the booking service
    // (lib/booking.ts), which prices the booking, charges and refunds
    // credits, and checks email verification and the class itself. Over
    // the API they could set their own price, credits or check-in, move a
    // booking to another class, or re-confirm a cancelled one.
    create: isAdmin,
    read: readBookings,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [enforceOwnershipAndCapacity],
    beforeChange: [assignCheckInCode],
  },
  fields: [
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      required: true,
      index: true,
    },
    {
      name: 'session',
      type: 'relationship',
      relationTo: 'sessions',
      required: true,
      index: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'confirmed',
      options: [
        { label: 'Confirmed', value: 'confirmed' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Attended', value: 'attended' },
        { label: 'No-show', value: 'noshow' },
      ],
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'web',
      options: [
        { label: 'Web', value: 'web' },
        { label: 'ClassPass', value: 'classpass' },
        { label: 'Manual (admin)', value: 'manual' },
      ],
      access: {
        // Only admins can manually choose the source on existing bookings.
        update: ({ req: { user } }) => user?.collection === 'admins',
      },
    },
    {
      name: 'paymentStatus',
      type: 'select',
      required: true,
      defaultValue: 'free',
      options: [
        { label: 'Free (covered or no-charge class)', value: 'free' },
        { label: 'Credit (charged to a membership pack)', value: 'credit' },
        { label: 'Unpaid (drop-in, pay at desk)', value: 'unpaid' },
        { label: 'Paid', value: 'paid' },
        { label: 'Refunded', value: 'refunded' },
      ],
      access: {
        update: ({ req: { user } }) => user?.collection === 'admins',
      },
      admin: {
        description:
          'Real payment integration arrives in v2. For now, drop-ins are marked unpaid and settled at the front desk.',
      },
    },
    {
      name: 'usedMembership',
      type: 'relationship',
      relationTo: 'memberships',
      admin: {
        description:
          'Which membership this booking was charged against (set automatically by the booking flow).',
      },
      access: {
        update: ({ req: { user } }) => user?.collection === 'admins',
      },
    },
    {
      name: 'creditsUsed',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Number of credits decremented from the linked membership (0 for unlimited).',
      },
      access: {
        update: ({ req: { user } }) => user?.collection === 'admins',
      },
    },
    {
      name: 'amountCents',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Amount owed for this booking in eurocents. Snapshot of priceCents at booking time.',
      },
      access: {
        update: ({ req: { user } }) => user?.collection === 'admins',
      },
    },
    {
      name: 'externalId',
      type: 'text',
      index: true,
      admin: {
        description: 'External provider id (e.g. ClassPass booking id). Set by integrations.',
      },
      access: {
        update: ({ req: { user } }) => user?.collection === 'admins',
      },
    },
    {
      name: 'checkInCode',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Encoded in the QR code the customer shows at the counter.',
      },
      access: {
        read: readCheckInCode,
        create: () => false,
        update: () => false,
      },
    },
    {
      name: 'checkedInAt',
      type: 'date',
      admin: {
        readOnly: true,
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Set when staff scan the code and check the customer in.',
      },
      access: {
        update: () => false,
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      access: {
        read: ({ req: { user } }) => user?.collection === 'admins',
        update: ({ req: { user } }) => user?.collection === 'admins',
      },
    },
  ],
}
