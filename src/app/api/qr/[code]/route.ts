import { findBookingByCode, qrPng } from '@/lib/checkIn'

/**
 * GET /api/qr/:code -> PNG of the booking's check-in QR code.
 *
 * Used by the confirmation email, because mail clients do not show inline
 * data: images. The code is 128 random bits and is the only secret in the
 * URL, so anyone holding the link could already show the QR; unknown codes
 * get a 404 so this is not an open QR generator.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const booking = await findBookingByCode(code)
  if (!booking) return new Response('Not found', { status: 404 })
  const png = await qrPng(code)
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=86400',
      'X-Robots-Tag': 'noindex',
    },
  })
}
