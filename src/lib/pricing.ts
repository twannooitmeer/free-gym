/**
 * Pricing logic for booking a session.
 *
 * Inputs:
 * - sessionType: priceCents + coveredByMembership + id
 * - customer: membershipStatus (legacy quick-flag, kept as fallback)
 * - activeMemberships: the customer's currently-active Memberships
 *   (Memberships docs, depth 1 with `type` populated).
 *
 * Selection order:
 *   1. If priceCents == 0, the class is always free (`free-class`).
 *   2. If any active unlimited / period membership covers this session
 *      type, the booking is free (`membership-unlimited`).
 *   3. If any active credits membership with creditsRemaining > 0
 *      covers this type, charge one credit (`credit`).
 *   4. Legacy fallback: if `coveredByMembership` is set and the
 *      customer.membershipStatus is 'active' or 'trial', free (kept so
 *      installations that haven't migrated to Memberships still work).
 *   5. Otherwise drop-in pricing (`drop-in`).
 *
 * Real payment collection (Mollie, iDEAL) lands in v2. Until then,
 * `unpaid` bookings are settled at the front desk.
 */

export type MembershipStatus = 'none' | 'trial' | 'active' | 'paused' | 'cancelled'

export type MembershipBillingModel = 'unlimited' | 'credits' | 'period'

export type MembershipTypeShape = {
  id: number | string
  billingModel?: MembershipBillingModel | string | null
  coversAllTypes?: boolean | null
  includedTypes?: Array<number | string | { id: number | string }> | null
}

export type ActiveMembership = {
  id: number | string
  status?: string | null
  creditsRemaining?: number | null
  endsAt?: string | null
  type?: MembershipTypeShape | number | string | null
}

export type SessionTypeShape = {
  id?: number | string
  priceCents?: number | null
  coveredByMembership?: boolean | null
}

export type PriceQuote = {
  amountCents: number
  free: boolean
  /** Stable key for i18n lookup under `book.reason.*`. */
  reason: 'free-class' | 'membership-unlimited' | 'credit' | 'covered' | 'trial' | 'drop-in'
  /** When set, this is the membership that will be charged. */
  chargeMembershipId?: number | string
  /** How many credits this booking will deduct (0 for unlimited). */
  creditsUsed: number
}

function membershipShape(m: ActiveMembership): MembershipTypeShape | null {
  if (m.type && typeof m.type === 'object') return m.type as MembershipTypeShape
  return null
}

function isMembershipActive(m: ActiveMembership): boolean {
  if (m.status && m.status !== 'active') return false
  if (m.endsAt) {
    const end = new Date(m.endsAt).getTime()
    if (Number.isFinite(end) && end < Date.now()) return false
  }
  return true
}

function coversThisType(typeShape: MembershipTypeShape | null, sessionTypeId?: number | string) {
  if (!typeShape) return false
  if (typeShape.coversAllTypes) return true
  if (sessionTypeId == null) return false
  const included = typeShape.includedTypes ?? []
  return included.some((entry) => {
    const id = typeof entry === 'object' ? entry.id : entry
    return String(id) === String(sessionTypeId)
  })
}

export function quoteBookingPrice(
  sessionType: SessionTypeShape,
  customer: { membershipStatus?: MembershipStatus | string | null },
  activeMemberships: ActiveMembership[] = [],
): PriceQuote {
  const price = Math.max(0, Number(sessionType.priceCents ?? 0))
  if (price === 0) {
    return { amountCents: 0, free: true, reason: 'free-class', creditsUsed: 0 }
  }

  const sessionTypeId = sessionType.id

  // 2) Unlimited / period membership that covers this type.
  for (const m of activeMemberships) {
    if (!isMembershipActive(m)) continue
    const shape = membershipShape(m)
    if (!shape) continue
    const model = shape.billingModel
    if ((model === 'unlimited' || model === 'period') && coversThisType(shape, sessionTypeId)) {
      return {
        amountCents: 0,
        free: true,
        reason: 'membership-unlimited',
        chargeMembershipId: m.id,
        creditsUsed: 0,
      }
    }
  }

  // 3) Credit pack with credits remaining that covers this type.
  for (const m of activeMemberships) {
    if (!isMembershipActive(m)) continue
    const shape = membershipShape(m)
    if (!shape || shape.billingModel !== 'credits') continue
    const remaining = Number(m.creditsRemaining ?? 0)
    if (remaining <= 0) continue
    if (!coversThisType(shape, sessionTypeId)) continue
    return {
      amountCents: 0,
      free: true,
      reason: 'credit',
      chargeMembershipId: m.id,
      creditsUsed: 1,
    }
  }

  // 4) Legacy fallback on Customers.membershipStatus.
  const covered = Boolean(sessionType.coveredByMembership)
  const status = (customer.membershipStatus ?? 'none') as MembershipStatus
  if (covered && status === 'active') {
    return { amountCents: 0, free: true, reason: 'covered', creditsUsed: 0 }
  }
  if (covered && status === 'trial') {
    return { amountCents: 0, free: true, reason: 'trial', creditsUsed: 0 }
  }

  // 5) Drop-in.
  return { amountCents: price, free: false, reason: 'drop-in', creditsUsed: 0 }
}

/** True if the membership can still be used for booking right now. */
export function isMembershipUsable(m: ActiveMembership): boolean {
  if (!isMembershipActive(m)) return false
  const shape = membershipShape(m)
  if (!shape) return false
  if (shape.billingModel === 'credits') return Number(m.creditsRemaining ?? 0) > 0
  return true
}

/** Format euro amount from cents using the page locale. */
export function formatEur(amountCents: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
  }).format(amountCents / 100)
}
