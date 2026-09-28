import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { materializeSeries } from '@/lib/materialize'
import { isCronAuthorized } from '@/lib/cronAuth'
import config from '@/payload.config'

/**
 * Daily cron: roll the materialization horizon forward.
 *
 * Trigger this once a day from anywhere (a host cron job or systemd timer, a Docker
 * cron sidecar, GitHub Actions, cron-job.org). The materializer is fully
 * idempotent so over-triggering is harmless.
 *
 * Auth: a static bearer token via the CRON_SECRET env var. Not a sub for
 * real auth, but it keeps random scanners from causing churn.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        $SITE_URL/api/cron/materialize-series
 *
 * GET and POST both work. We return JSON with per-series counts so the
 * trigger's logs are useful when something looks off.
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

  const seriesRes = await payload.find({
    collection: 'session-series',
    where: { active: { equals: true } },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })

  const results: Array<{ id: number | string; name: string; created: number; skipped: number }> = []
  let totalCreated = 0
  let totalSkipped = 0
  let failed = 0

  for (const series of seriesRes.docs) {
    try {
      const r = await materializeSeries(payload, series)
      results.push({ id: series.id, name: series.name, created: r.created, skipped: r.skipped })
      totalCreated += r.created
      totalSkipped += r.skipped
    } catch (err) {
      failed += 1
      payload.logger.error({
        msg: '[cron/materialize-series] series failed',
        seriesId: series.id,
        err: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({
    ok: true,
    seriesProcessed: seriesRes.docs.length,
    totalCreated,
    totalSkipped,
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
