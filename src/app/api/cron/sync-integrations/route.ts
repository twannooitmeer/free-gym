import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { getProvider, type IntegrationProviderId } from '@/lib/integrations'
import { isCronAuthorized } from '@/lib/cronAuth'
import config from '@/payload.config'

/**
 * Periodic cron: pull bookings/availability from every enabled external
 * integration.
 *
 * Trigger alongside the materialize-series cron from systemd / GitHub
 * Actions / etc. v1 providers are all stubs, so this route is here so
 * the wiring is in place, flipping a provider from no-op to real is a
 * one-file change in src/lib/integrations/.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        $SITE_URL/api/cron/sync-integrations
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'cron-not-configured' }, { status: 503 })
  }

  if (!isCronAuthorized(req.headers.get('authorization'), secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const integrations = await payload.find({
    collection: 'integrations',
    where: { enabled: { equals: true } },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  const results: Array<{
    id: number | string
    name: string
    provider: string
    ok: boolean
    status: string
    pulled?: number
    error?: string
  }> = []
  let failed = 0

  for (const row of integrations.docs) {
    const providerId = (row as { provider?: string }).provider as
      | IntegrationProviderId
      | undefined
    if (!providerId) continue
    const provider = getProvider(providerId)
    if (!provider) {
      failed += 1
      results.push({
        id: row.id,
        name: row.name,
        provider: providerId,
        ok: false,
        status: 'unknown-provider',
      })
      continue
    }

    try {
      const r = await provider.pullBookings({
        id: row.id,
        name: row.name,
        provider: providerId,
        enabled: true,
        config: (row as { config?: unknown }).config ?? null,
        lastSyncAt: (row as { lastSyncAt?: string | null }).lastSyncAt ?? null,
        payload,
      })

      results.push({
        id: row.id,
        name: row.name,
        provider: providerId,
        ok: r.ok,
        status: r.status,
        pulled: r.pulled,
        error: r.error,
      })
      if (!r.ok) failed += 1

      // Stamp the run on the integration row so admins can see when the
      // last sync happened straight from the list view.
      try {
        await payload.update({
          collection: 'integrations',
          id: row.id,
          data: {
            lastSyncAt: new Date().toISOString(),
            lastSyncStatus: r.ok ? r.status : `error: ${r.error ?? r.status}`,
          },
          overrideAccess: true,
        })
      } catch {
        // Non-fatal: the sync itself succeeded.
      }
    } catch (err) {
      failed += 1
      payload.logger.error({
        msg: '[cron/sync-integrations] provider threw',
        integrationId: row.id,
        provider: providerId,
        err: err instanceof Error ? err.message : String(err),
      })
      results.push({
        id: row.id,
        name: row.name,
        provider: providerId,
        ok: false,
        status: 'threw',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({
    ok: true,
    processed: integrations.docs.length,
    failed,
    results,
  })
}

export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}
