/**
 * Scheduling core: recurrence, booking invariants and check-in codes.
 *
 * Boundary rule (checked in CI by scripts/check-conventions.mjs): nothing in
 * this folder imports `payload`, `@payloadcms/*`, Next.js or React. It is
 * plain functions over plain data, so it can be tested alone and later be
 * split into a package shared with other scheduling apps without a rewrite.
 * Code that talks to Payload or the database imports from here, never the
 * other way round.
 */
export * from './bookings'
export * from './checkIn'
export * from './countdown'
export * from './recurrence'
