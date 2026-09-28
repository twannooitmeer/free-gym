import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'

import { capacityLockKey } from './scheduling'

/**
 * The Drizzle handle of the transaction `req` belongs to.
 *
 * Payload opens a transaction per operation and keeps its connection in
 * `payload.db.sessions[transactionID]`. Raw SQL that must see, or lock
 * within, the same transaction as the surrounding Payload operation has
 * to run on this handle, not on `payload.db.drizzle` (a pool connection
 * outside it). Throws rather than silently falling back: a
 * transaction-scoped lock taken outside a transaction releases at once
 * and protects nothing.
 */
export async function transactionDb(req: PayloadRequest) {
  const id = await req.transactionID
  const db =
    id != null ? (req.payload.db as unknown as PostgresAdapter).sessions?.[id]?.db : undefined
  if (!db) {
    throw new Error('transactionDb: called outside a Payload transaction')
  }
  return db
}

/**
 * Serialise every seat check for one session until the surrounding
 * transaction commits or rolls back (booking invariant 2).
 */
export async function lockSessionSeats(req: PayloadRequest, sessionId: number | string) {
  const [namespace, key] = capacityLockKey(sessionId)
  const db = await transactionDb(req)
  await db.execute(sql`select pg_advisory_xact_lock(${namespace}, ${key})`)
}

/**
 * Spend `credits` from a credit pack in one statement, only if that many
 * are left (booking invariant 3). Returns false when the pack no longer
 * has enough, which the caller turns into a rollback.
 */
export async function spendCredits(
  req: PayloadRequest,
  membershipId: number | string,
  credits: number,
): Promise<boolean> {
  const db = await transactionDb(req)
  const res = await db.execute(sql`
    update memberships
       set credits_remaining = credits_remaining - ${credits}, updated_at = now()
     where id = ${Number(membershipId)} and credits_remaining >= ${credits}
     returning id`)
  return res.rows.length === 1
}

/**
 * Give credits back to a pack (on cancellation), in the caller's
 * transaction, and only to a pack that belongs to that customer.
 */
export async function refundCredits(
  req: PayloadRequest,
  membershipId: number | string,
  credits: number,
  customerId: number | string,
) {
  const db = await transactionDb(req)
  await db.execute(sql`
    update memberships
       set credits_remaining = credits_remaining + ${credits}, updated_at = now()
     where id = ${Number(membershipId)} and customer_id = ${Number(customerId)}`)
}

/**
 * Use one email-verification attempt, if any are left, in a single
 * statement: parallel guesses cannot each read "4 used" and all try.
 */
export async function consumeVerificationAttempt(
  payload: { db: unknown },
  customerId: number | string,
  maxAttempts: number,
): Promise<boolean> {
  const db = (payload.db as unknown as PostgresAdapter).drizzle
  const res = await db.execute(sql`
    update customers
       set verification_attempts = coalesce(verification_attempts, 0) + 1
     where id = ${Number(customerId)} and coalesce(verification_attempts, 0) < ${maxAttempts}
     returning id`)
  return res.rows.length === 1
}

/**
 * Lock one booking row for the rest of the transaction and return its
 * current status, so two concurrent cancellations cannot both refund.
 */
export async function lockBooking(
  req: PayloadRequest,
  bookingId: number | string,
): Promise<{ status: string; customerId: number } | null> {
  const db = await transactionDb(req)
  const res = await db.execute(sql`
    select status, customer_id from bookings where id = ${Number(bookingId)} for update`)
  const row = res.rows[0] as { status: string; customer_id: number } | undefined
  return row ? { status: row.status, customerId: row.customer_id } : null
}
