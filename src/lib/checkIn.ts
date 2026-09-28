import { getPayload } from 'payload'
import QRCode from 'qrcode'

import type { Booking } from '@/payload-types'
import config from '@/payload.config'

import { checkInPath, isCheckInCode } from './scheduling'

const siteUrl = () => (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

/** Absolute URL the QR code encodes: the staff check-in page for this booking. */
export function checkInUrl(code: string): string {
  return `${siteUrl()}${checkInPath(code)}`
}

/** Absolute URL of the QR image, for emails (mail clients block inline data: images). */
export function qrImageUrl(code: string): string {
  return `${siteUrl()}/api/qr/${code}`
}

const QR_OPTIONS = { errorCorrectionLevel: 'M', margin: 2 } as const

/** QR code as an SVG string, for pages. Output is generated markup, not user input. */
export function qrSvg(code: string): Promise<string> {
  return QRCode.toString(checkInUrl(code), { ...QR_OPTIONS, type: 'svg' })
}

/** QR code as a PNG, for emails. */
export function qrPng(code: string): Promise<Buffer> {
  return QRCode.toBuffer(checkInUrl(code), { ...QR_OPTIONS, type: 'png', width: 480 })
}

/** The booking a code belongs to, with session, type, teacher and customer populated. */
export async function findBookingByCode(code: string): Promise<Booking | null> {
  if (!isCheckInCode(code)) return null
  const payload = await getPayload({ config: await config })
  const res = await payload.find({
    collection: 'bookings',
    where: { checkInCode: { equals: code } },
    depth: 2,
    limit: 1,
    overrideAccess: true,
  })
  return res.docs[0] ?? null
}
