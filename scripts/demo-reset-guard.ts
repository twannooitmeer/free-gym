/** demo:reset drops every table; it may only ever run on a public demo. */
export function assertDemoResetAllowed(env: Record<string, string | undefined> = process.env) {
  if (env.DEMO_MODE !== '1') {
    throw new Error('demo:reset wipes the whole database; it only runs with DEMO_MODE=1')
  }
}
