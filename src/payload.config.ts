import { postgresAdapter, sql } from '@payloadcms/db-postgres'
import { uniqueIndex } from '@payloadcms/db-postgres/drizzle/pg-core'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Admins } from './collections/Admins'
import { Bookings } from './collections/Bookings'
import { Customers } from './collections/Customers'
import { Integrations } from './collections/Integrations'
import { Media } from './collections/Media'
import { Memberships } from './collections/Memberships'
import { MembershipTypes } from './collections/MembershipTypes'
import { SessionTypes } from './collections/SessionTypes'
import { SessionSeries } from './collections/SessionSeries'
import { Sessions } from './collections/Sessions'
import { Teachers } from './collections/Teachers'
import { Email } from './globals/Email'
import { Settings } from './globals/Settings'
import { Theme } from './globals/Theme'
import { CANCELLED_STATUS, ONE_ACTIVE_BOOKING_INDEX } from './lib/scheduling'
import { migrations } from './migrations'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Public origin of the site. When set, Payload only accepts its session
// cookie from this origin (CSRF protection) and builds absolute URLs with it.
const siteUrl = process.env.SITE_URL?.replace(/\/$/, '') || undefined

export default buildConfig({
  serverURL: siteUrl,
  csrf: siteUrl ? [siteUrl] : [],
  admin: {
    // Only the Admins collection can log into the Payload admin panel.
    // Customers and teachers sign in on the public site (same Payload auth,
    // see lib/session.ts).
    user: Admins.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    Admins,
    Customers,
    Teachers,
    SessionTypes,
    SessionSeries,
    Sessions,
    Bookings,
    MembershipTypes,
    Memberships,
    Integrations,
    Media,
  ],
  globals: [Settings, Theme, Email],
  localization: {
    locales: [
      { label: 'Nederlands', code: 'nl' },
      { label: 'English', code: 'en' },
    ],
    defaultLocale: 'nl',
    fallback: true,
  },
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    // Development pushes the schema directly; production (NODE_ENV=production)
    // applies these migrations on startup, so a fresh `docker compose up`
    // creates the whole schema and later releases upgrade it in place.
    // After changing a collection: pnpm payload migrate:create <name>
    prodMigrations: migrations,
    // Booking invariant 1 (see lib/scheduling/bookings.ts): at most one
    // active booking per customer and session, enforced by Postgres so it
    // holds for every write path, not only the ones that run our hooks.
    afterSchemaInit: [
      ({ schema, extendTable }) => {
        extendTable({
          table: schema.tables.bookings,
          extraConfig: (t) => ({
            oneActiveBooking: uniqueIndex(ONE_ACTIVE_BOOKING_INDEX)
              .on(t.customer, t.session)
              .where(sql`${t.status} <> ${sql.raw(`'${CANCELLED_STATUS}'`)}`),
          }),
        })
        return schema
      },
    ],
  }),
  sharp,
  plugins: [],
})

