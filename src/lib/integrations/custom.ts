/**
 * Custom / generic provider, STUB.
 *
 * Catch-all for one-off integrations (Eversports, MindBody export, etc.)
 * that don't justify their own implementation file. v1 just returns
 * no-op success so admins can create an Integration row and exercise
 * the cron route without ClassPass-specific config.
 */

import type {
  IntegrationContext,
  IntegrationProvider,
  SyncResult,
} from './types'

export const CustomProvider: IntegrationProvider = {
  id: 'custom',
  name: 'Custom',

  isConfigured() {
    return true
  },

  async pullBookings(): Promise<SyncResult> {
    return { ok: true, status: 'noop (custom stub)', pulled: 0 }
  },

  async pushBooking(): Promise<SyncResult> {
    return { ok: true, status: 'noop (custom stub)', pushed: 0 }
  },
}
