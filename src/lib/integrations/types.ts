/**
 * IntegrationProvider: the contract every external booking/CRM
 * connector implements. v1 only ships the interface plus a ClassPass
 * stub so the rest of the system can wire in providers without
 * scattering vendor-specific branches across the codebase.
 *
 * Lifecycle:
 *   1. Admin creates/edits an Integration row in the admin panel.
 *   2. A background job (cron / webhook handler) resolves the matching
 *      provider via `getProvider(integration.provider)` and calls
 *      `pullBookings` / `pushBooking` / etc.
 *   3. Provider implementations read their secrets from
 *      `integration.config` (typed as `unknown` to keep the schema
 *      flexible across vendors).
 *
 * v2 additions will likely include:
 *   - Webhook signature verification helpers.
 *   - A shared error class so the cron route can distinguish
 *     transient failures (retry) from permanent ones (mark disabled).
 */

import type { Payload } from 'payload'

export type IntegrationProviderId = 'classpass' | 'custom'

/** Shape of the Integration document fields the providers care about. */
export type IntegrationContext = {
  id: number | string
  name: string
  provider: IntegrationProviderId
  enabled: boolean
  /** Free-form provider-specific config (API keys, studio id, ...). */
  config: unknown
  lastSyncAt?: string | null
  /** Payload instance scoped to the current request. Lets the provider
   *  read related collections (sessions, customers, bookings) without
   *  re-instantiating the SDK. */
  payload: Payload
}

/** Standard sync result. Providers should never throw; wrap their own
 *  errors and surface them via `error` so the cron route can log and
 *  persist `lastSyncStatus` consistently. */
export type SyncResult = {
  ok: boolean
  /** Short status string written to `Integration.lastSyncStatus`. */
  status: string
  /** Optional counts for observability. */
  pulled?: number
  pushed?: number
  /** When `ok` is false, a human-readable error message. */
  error?: string
}

export interface IntegrationProvider {
  /** Stable identifier matching the `provider` select option. */
  readonly id: IntegrationProviderId
  /** Display name for logs and admin UI. */
  readonly name: string

  /** Cheap config check. Returns true when the integration has enough
   *  config to attempt a sync. */
  isConfigured(ctx: IntegrationContext): boolean

  /** Pull external bookings/availability into local Bookings/Sessions.
   *  Called from the cron route on a schedule. */
  pullBookings(ctx: IntegrationContext): Promise<SyncResult>

  /** Push a locally-created booking to the external provider.
   *  Called from confirmBooking when the customer originated externally
   *  (v2). For now providers can return `{ok: true, status: 'noop'}`. */
  pushBooking(
    ctx: IntegrationContext,
    bookingId: number | string,
  ): Promise<SyncResult>
}
