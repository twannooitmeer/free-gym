import { describe, expect, it } from 'vitest'

import { bookingConfirmationEmail } from '@/lib/emails/messages'

const base = {
  name: 'Sam <script>',
  className: 'Boxing',
  teacherName: 'Coach',
  startsAtIso: '2026-10-01T17:00:00.000Z',
  location: 'Main hall',
  paymentNote: null,
  gymName: 'Demo Gym',
  registrationUrl: 'https://book.example.test/en/me/bookings/7',
  qrImageUrl: 'https://book.example.test/api/qr/abcdefghijklmnopqrstuv',
}

describe('booking confirmation email', () => {
  for (const locale of ['en', 'nl'] as const) {
    it(`${locale}: carries the QR image, the registration link and the gym name`, () => {
      const msg = bookingConfirmationEmail({ ...base, locale })
      expect(msg.html).toContain(`<img src="${base.qrImageUrl}"`)
      expect(msg.html).toContain(base.registrationUrl)
      expect(msg.text).toContain(base.registrationUrl)
      expect(msg.html).toContain('DEMO GYM')
      expect(msg.html).not.toContain('<script>')
    })
  }

  it('leaves the QR block out when a booking has no code', () => {
    const msg = bookingConfirmationEmail({ ...base, locale: 'en', qrImageUrl: null })
    expect(msg.html).not.toContain('<img')
    expect(msg.html).toContain(base.registrationUrl)
  })
})
