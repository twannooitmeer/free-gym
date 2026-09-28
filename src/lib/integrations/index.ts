/**
 * Provider registry. Single lookup point so the rest of the codebase
 * never imports vendor-specific files directly.
 *
 * Adding a new provider:
 *   1. Implement IntegrationProvider in a new file under this folder.
 *   2. Add it to the PROVIDERS map below.
 *   3. Add the matching option to Integrations.ts `provider` select.
 *   4. Re-run `pnpm payload generate:types`.
 */

import { ClassPassProvider } from './classpass'
import { CustomProvider } from './custom'
import type { IntegrationProvider, IntegrationProviderId } from './types'

const PROVIDERS: Record<IntegrationProviderId, IntegrationProvider> = {
  classpass: ClassPassProvider,
  custom: CustomProvider,
}

export function getProvider(id: IntegrationProviderId): IntegrationProvider {
  return PROVIDERS[id]
}

export function listProviders(): IntegrationProvider[] {
  return Object.values(PROVIDERS)
}

export type { IntegrationProvider, IntegrationProviderId, SyncResult, IntegrationContext } from './types'
