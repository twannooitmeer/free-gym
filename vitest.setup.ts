// Load .env, then point the integration tests at their own database when
// TEST_DATABASE_URL is set, so a test run never writes into the dev data.
// Payload creates the database on first connect if it does not exist.
import 'dotenv/config'

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
}
