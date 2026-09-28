/**
 * Wipe and reseed a PUBLIC DEMO installation (DEMO_MODE=1 only).
 *
 * Drops every table, re-runs the migrations and runs the seed, so the demo
 * starts each day clean whatever visitors did to it. Run it from the
 * `tools` image (docker compose --profile tools run --rm tools), e.g. from a
 * nightly timer on the host.
 */
import { getPayload } from 'payload'

import { isDemoMode } from '../src/lib/demo'
import config from '../src/payload.config'
import { assertDemoResetAllowed } from './demo-reset-guard'
import { seed } from './seed'

async function main() {
  assertDemoResetAllowed()
  if (!isDemoMode()) return
  const payload = await getPayload({ config: await config })
  console.log('demo:reset: dropping all tables and re-running migrations...')
  await payload.db.migrateFresh({ forceAcceptWarning: true })
  await seed(payload)
  console.log('demo:reset: done')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
