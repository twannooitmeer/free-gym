/**
 * Demo mode (DEMO_MODE=1): for a public demo installation, never for a
 * real gym. It shows a notice with the public demo logins, asks search
 * engines not to index the site, freezes the shared demo accounts, and
 * allows `pnpm demo:reset` (wipe and reseed). See README, "Public demo".
 */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === '1'
}

/** The seed's demo accounts. Their passwords are public on purpose. */
export const DEMO_TEACHER = {
  email: 'teacher@example.test',
  password: 'demo-teacher-pass',
  name: 'Demo Teacher',
}
export const DEMO_CUSTOMER = {
  email: 'customer@example.test',
  password: 'demo-customer-pass',
  name: 'Demo Customer',
}
