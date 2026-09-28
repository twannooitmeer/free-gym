/**
 * ClassPass provider, STUB.
 *
 * Real ClassPass partner API access is gated behind a studio agreement.
 * Until that's in place this provider only validates config shape and
 * returns no-op sync results so the admin UI is wireable end-to-end.
 *
 * v2 will replace the bodies with real calls against:
 *   https://api.classpass.com/partners/v1
 */

import type {
  IntegrationContext,
  IntegrationProvider,
  SyncResult,
} from './types'

type ClassPassConfig = {
  studioId?: string
  apiKey?: string
}

function readConfig(ctx: IntegrationContext): ClassPassConfig {
  if (typeof ctx.config === 'object' && ctx.config !== null) {
    return ctx.config as ClassPassConfig
  }
  return {}
}

export const ClassPassProvider: IntegrationProvider = {
  id: 'classpass',
  name: 'ClassPass',

  isConfigured(ctx) {
    const c = readConfig(ctx)
    return Boolean(c.studioId && c.apiKey)
  },

  async pullBookings(ctx): Promise<SyncResult> {
    if (!this.isConfigured(ctx)) {
      return { ok: false, status: 'not-configured', error: 'studioId and apiKey are required' }
    }
    // Stub: real implementation will call ClassPass partner API and
    // upsert into the bookings collection.
    return { ok: true, status: 'noop (stub)', pulled: 0 }
  },

  async pushBooking(ctx): Promise<SyncResult> {
    if (!this.isConfigured(ctx)) {
      return { ok: false, status: 'not-configured', error: 'studioId and apiKey are required' }
    }
    return { ok: true, status: 'noop (stub)', pushed: 0 }
  },
}
