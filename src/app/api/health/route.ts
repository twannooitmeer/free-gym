import { sql } from '@payloadcms/db-postgres'
import { getPayload } from 'payload'

import { checkHealth } from '@/lib/health'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

/**
 * GET /api/health, for uptime monitors and the container healthcheck.
 * Body is {"status":"ok","db":"ok"} (under 40 bytes). Monitors match on
 * "status":"ok" and must not follow redirects; this route never redirects.
 */
export async function GET() {
  const { body, code } = await checkHealth(async () => {
    const payload = await getPayload({ config: await config })
    await payload.db.drizzle.execute(sql`select 1`)
  })
  return Response.json(body, {
    status: code,
    headers: { 'Cache-Control': 'no-store' },
  })
}
