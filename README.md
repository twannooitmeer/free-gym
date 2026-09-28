# free-gym

A self-hostable website and booking system for one gym or martial-arts
studio: a public class schedule, self-service booking for members, a
check-in QR code per booking, credit packs and memberships, and a
portal for teachers. You run it on your own server with one
`docker compose up`; the gym's name, details and texts are edited in the
admin panel, not in code.

Built with Next.js 16, Payload CMS 3 and Postgres 16. Dutch and English
out of the box. Licensed under the AGPL-3.0.

## What it does

**Members**

- Browse the week schedule (desktop grid, mobile day view), filter by
  class type.
- Create an account, optionally verify their email with a six-digit code,
  and book a class in two clicks. The price is shown before booking: free
  classes, unlimited memberships, credit packs, or pay at the desk.
- Every booking has its own registration page with a **check-in QR code**:
  "Show code at the counter" opens it full screen, white, with the screen
  kept on. The same code is in the confirmation email.
- When a class starts within 24 hours, a banner on every page counts down
  to it and links straight to the registration.
- Cancel a booking; a used credit is refunded.

**Teachers**

- See their upcoming classes and who signed up (names only; contact
  details stay hidden).
- Scan a member's QR code and check them in.

**The gym (admin panel at `/admin`)**

- Gym details: name, tagline, about text, contact details, default
  location, links to your own terms and privacy policy.
- Class types with prices and colours, recurring series (for example
  "Mon and Wed 18:00") that generate the schedule weeks ahead, one-off
  sessions, cancellations.
- Membership types (unlimited, period, credit packs) and each member's
  memberships.
- Opening hours (they set the schedule grid's range), schedule colours,
  and the email settings.

## Quick start

You need a Linux server with Docker and Docker Compose, a domain name,
and a reverse proxy that terminates TLS (examples below).

```bash
git clone https://github.com/twannooitmeer/free-gym.git
cd free-gym
cp .env.example .env
```

Fill in every value marked REQUIRED in `.env`. Generate secrets with
`openssl rand -hex 32`. Then:

```bash
docker compose up -d --build
```

On first start the app creates its database schema. **Create the admin
account before the site is reachable from the internet**: until one
exists, whoever opens `/admin` first can create it. Either do it over an
SSH tunnel (`ssh -L 3000:127.0.0.1:3000 your-server`, then
`http://localhost:3000/admin`) or enable the reverse proxy afterwards.
Then fill in
**Site Settings → Gym details**. Add class types and a recurring series,
and the schedule fills itself.

The app listens on `127.0.0.1:3000` only (change with `APP_PORT`);
Postgres is not reachable from outside the stack at all.

## Configuration

| Variable | Required | What it is |
|---|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | yes | Database credentials. Compose refuses to start without them. |
| `PAYLOAD_SECRET` | yes | Signs session cookies. |
| `CRON_SECRET` | yes | Bearer token for the scheduled job routes. |
| `SITE_URL` | yes | Public `https://` address. Used in emails and as the only origin allowed to use the session cookie. |
| `APP_PORT` | no | Host port on 127.0.0.1, default 3000. |
| `TZ` | no | The gym's time zone, default `Europe/Amsterdam`. |
| `RESEND_API_KEY`, `EMAIL_FROM` | no | Email fallback; the admin panel's Email settings take precedence. |

## Reverse proxy

Forward everything to `127.0.0.1:3000`, keep the `Host` header, and block
the scheduled-job routes from the internet (the host calls them directly,
see below). With [Caddy](https://caddyserver.com):

```
book.example.com {
	@cron path /api/cron/*
	respond @cron 404
	reverse_proxy 127.0.0.1:3000
}
```

With nginx: `proxy_set_header Host $host;`,
`proxy_set_header X-Forwarded-Proto $scheme;`, and a
`location /api/cron/ { return 404; }` block.

## Scheduled jobs

Two routes keep the schedule rolling; run them daily from the host, on
the local port, so they never need to be public:

```bash
# crontab -e
0 3 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/materialize-series
5 3 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/sync-integrations
```

`materialize-series` generates sessions from recurring series up to each
series' horizon. `sync-integrations` is for external booking providers;
the ClassPass and custom providers are stubs in this version.

## Email

Transactional email (verification codes, booking confirmations with the
QR code) goes through [Resend](https://resend.com), a plain HTTPS API.
Verify a sending domain there, then enter the API key and From address in
**Admin → Configuration → Email** (or set the env fallbacks). Without a
provider, messages are logged instead of sent, and bookings still work.
"Require email verification" can only be switched on once a working
sender is configured.

## Monitoring

`GET /api/health` returns `{"status":"ok","db":"ok"}` (25 bytes, never
cached), or HTTP 503 with `"down"` when Postgres does not answer. The
container healthcheck uses it. For an uptime monitor, match the keyword
`"status":"ok"` and do not follow redirects.

## Upgrading and backups

```bash
git pull
docker compose up -d --build
```

Schema changes ship as migrations and are applied automatically when the
new version starts. Back up the database before upgrading:

```bash
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > free-gym-$(date +%F).sql
```

Uploaded images (teacher avatars) are in the `media` volume; back it up
too if you use them.

## Development

Requirements: Node 24, pnpm 11 (`corepack enable`), Docker.

```bash
docker compose -f docker-compose.dev.yml up -d   # Postgres only; POSTGRES_PORT if 5432 is taken
cp .env.example .env                              # set PAYLOAD_SECRET and CRON_SECRET
pnpm install
pnpm dev                                          # http://localhost:3000, admin at /admin
pnpm seed                                         # demo data
```

In development the schema follows the code automatically. After changing
a collection, create a migration for production:
`pnpm payload migrate:create <name>`.

Demo accounts after `pnpm seed` (the passwords are public; the seed
refuses to run with `NODE_ENV=production`):

| Role | Email | Password | Where |
|---|---|---|---|
| Admin | `admin@example.test` | `demo-admin-pass` | `/admin` |
| Teacher | `teacher@example.test` | `demo-teacher-pass` | `/login?role=teacher` |
| Customer | `customer@example.test` | `demo-customer-pass` | `/login` |

### Checks

```bash
pnpm test:int          # unit + integration tests (needs Postgres; uses TEST_DATABASE_URL)
pnpm test:e2e          # Playwright; starts its own server on :3100
pnpm lint
pnpm check             # conventions + privacy sweep
```

`pnpm check` runs two scripts that CI also runs:
`scripts/check-conventions.mjs` (hooks pass `req`, no default passwords in
compose, a health route exists, `src/lib/scheduling` stays
framework-free) and `scripts/check-pii.mjs` (no real names, email
addresses, phone numbers or IBANs in tracked files).

## How it works

- **One auth system.** Admins, teachers and customers are three Payload
  auth collections. The public site signs people in with Payload's own
  HTTP-only session cookie; five wrong passwords lock an account for ten
  minutes.
- **Booking rules live in Postgres.** One active booking per member and
  class is a partial unique index. Capacity is checked under a per-class
  advisory lock inside the booking's transaction, so two people cannot
  both get the last seat. Charging a credit is a single conditional
  update in the same transaction, so the last credit cannot be spent
  twice, and a double cancel cannot refund twice. See
  `src/lib/scheduling/bookings.ts`.
- **Scheduling core.** Recurrence, booking rules, check-in codes and the
  countdown are plain functions in `src/lib/scheduling/`, with no
  framework imports, so they can be tested alone and reused.
- **Check-in codes.** 128 random bits per booking, set on creation, never
  changeable, readable only by the member who owns the booking and by
  admins. The QR code encodes `SITE_URL/checkin/<code>`: an admin or the
  class's teacher can check the member in there; anyone else sees only a
  short explanation.

## Security model and known limitations

- Members change data only through the site. Payload's REST and GraphQL
  APIs let customers read their own profile, bookings and memberships,
  and nothing else; booking, cancelling, signing up and editing the
  profile go through server actions that do their own checks. Only
  admins create teacher or customer accounts over the API (including
  Payload's first-register route).
- Members' phone numbers, dates of birth and notes are protected at the
  field level; teachers see attendee names only.
- The operator of an installation is the data controller for its
  members' personal data (AVG/GDPR). Publish your own privacy policy and
  link it in Site Settings; this project does not ship one.
- Sign-up has no CAPTCHA. Add a rate limit on `/*/signup` and the login
  routes at your reverse proxy if abuse appears.
- Online payment is not included; paid classes are settled at the desk.
- Found a vulnerability? See [SECURITY.md](SECURITY.md).

## License

[GNU Affero General Public License v3.0](LICENSE). If you run a modified
version for others over a network, you must offer them its source.
