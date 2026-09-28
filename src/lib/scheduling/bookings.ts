/**
 * Booking invariants, as plain data and plain decisions.
 *
 * What must hold, whatever path writes a booking (the site, the admin
 * panel, the REST API, an integration):
 *
 * 1. A customer holds at most one active booking per session. Enforced by
 *    a partial unique index (see payload.config.ts), so it holds even for
 *    writes that skip every hook.
 * 2. A session never holds more active bookings than its capacity.
 *    Enforced by checking the count while holding a per-session
 *    transaction-scoped advisory lock (see ../db.ts), so two requests for
 *    the last seat are serialised instead of both reading "one left".
 * 3. A credit pack is never charged below zero. Enforced by a single
 *    conditional UPDATE, so two bookings cannot both spend the last credit.
 *
 * The Payload hooks only turn a violation into a friendly error message.
 */

/** Every status except this one holds a seat and counts as a booking. */
export const CANCELLED_STATUS = 'cancelled'

export function holdsSeat(status: string | null | undefined): boolean {
  return (status ?? 'confirmed') !== CANCELLED_STATUS
}

/** Name of the partial unique index behind invariant 1. */
export const ONE_ACTIVE_BOOKING_INDEX = 'bookings_one_active_per_customer_session'

export function hasFreeSeat(capacity: number | null | undefined, held: number): boolean {
  if (typeof capacity !== 'number') return true
  return held < capacity
}

/**
 * Advisory lock key for a session's seats: pg_advisory_xact_lock(int, int).
 * The first int namespaces this app's locks so they cannot collide with any
 * other advisory lock user on the same database.
 */
export const CAPACITY_LOCK_NAMESPACE = 0x46_47 // "FG"

export function capacityLockKey(sessionId: number | string): [number, number] {
  const id = Number(sessionId)
  if (!Number.isInteger(id)) throw new Error(`capacityLockKey: not an integer id: ${sessionId}`)
  return [CAPACITY_LOCK_NAMESPACE, id]
}

/** Error codes the booking flow returns to the UI. */
export type BookingError = 'full' | 'duplicate' | 'credits-changed' | 'failed'
