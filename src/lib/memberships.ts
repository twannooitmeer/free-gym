import type { Payload } from 'payload'

import type { ActiveMembership } from './pricing'

/**
 * Load a customer's currently-active memberships (depth 1 so `type` is
 * populated). Used by both the booking flow (to quote price) and the
 * /me portal (to display credits remaining).
 *
 * `status === 'active'` only; expiry is checked at quote time so a
 * recently-expired row still shows up in /me if we want to surface it
 * (we filter again in the UI). Sorted by createdAt ascending so the
 * oldest pack is consumed first.
 */
export async function loadActiveMemberships(
  payload: Payload,
  customerId: number | string,
): Promise<ActiveMembership[]> {
  const res = await payload.find({
    collection: 'memberships',
    where: {
      and: [{ customer: { equals: customerId } }, { status: { equals: 'active' } }],
    },
    sort: 'createdAt',
    depth: 1,
    limit: 50,
    overrideAccess: true,
  })
  return res.docs as unknown as ActiveMembership[]
}
