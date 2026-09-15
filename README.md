# ReliantOutreach

**Delivery remains local by the owner's instruction.** No source was pushed to GitHub and no Hostinger deployment was submitted. Start with [DELIVERY_GUIDE.md](DELIVERY_GUIDE.md) for the requested 16-part handoff, [TEST_REPORT.md](TEST_REPORT.md) for verification, and [RELEASE_GATES.md](RELEASE_GATES.md) for unfinished work.

A single Next.js full-stack outreach application for Hostinger managed Node.js hosting, using Prisma + MySQL and a server-side Manyreach REST v2 integration.

**Status: implemented application, not a production-approved release.** The production build and local MySQL checks pass, Hostinger SMTP authentication is configured locally, and the supplied Manyreach Swagger v2.5.0 contract matches the checked 90-endpoint manifest. The user's full live acceptance scenario has not been executed. Read [RELEASE_GATES.md](RELEASE_GATES.md) before deployment. In particular, webhooks are deliberately disabled and strict monthly sending caps remain unresolved; finite monthly caps block new campaign starts and manual replies.

## What is implemented

- Better Auth email/password sessions, database-backed authentication throttling, password reset emails, invitation-only account provisioning, and a one-time Superadmin bootstrap.
- Separate `/admin` and `/app` experiences with the blue/yellow ReliantOutreach identity, responsive sidebar, real loading/error/empty states, and no demo data.
- MySQL-backed packages, feature permissions, limits, per-client overrides, membership roles, suspension and audited 30-minute impersonation.
- Superadmin package editor, client creation/mapping wizard, invitations, client package/override controls, users listing, audit log, job monitor and system health.
- Central Manyreach adapter: official X-API-Key authentication; per-clientspace credentials encrypted with AES-256-GCM; no browser-provider calls; bounded GET retries, timeouts, per-organization request budgets and Retry-After cooldown.
- Repeatable Manyreach Swagger contract verification with `npm run verify:manyreach -- C:\path\to\v2.json`; the source specification remains outside the repository.
- Live campaign list/detail, draft builder, basic campaign editor, start/pause, draft duplication; sequences and follow-up creation/edit; prospects/lists/senders CRUD; CSV mapping and background imports; incoming replies, prospect message history and replies; campaign-specific time-series analytics and CSV export.
- Encrypted, tenant-bound external identifiers. Every client operation derives the tenant from the stored session and membership. The server uses only that clientspace's key.
- MySQL job processor invoked by one authenticated cron endpoint. Imports are encrypted temporary payloads, processed in groups of at most 100 rows. No Redis, separate worker, Docker, root access or permanent daemon.

## Architecture

```text
Browser → Next.js page / route handler
        → Better Auth session → tenant → RBAC → package policy
        → centralized Manyreach adapter → Manyreach REST v2

Next.js → Prisma → Hostinger MySQL (identity, policy, metadata, jobs)
Hostinger cron → authenticated POST → bounded MySQL job processor
```

Manyreach is authoritative for outreach resources. The app does not persist inbox bodies, campaign copies, prospect databases or full API responses. Import rows are the exception: encrypted temporarily until the import completes/fails/expires.

## Folder structure

```text
.github/workflows/ci.yml       build, lint, typecheck, unit and browser checks
prisma/
  schema.prisma               MySQL schema
  migrations/                 initial SQL and migration lock
scripts/bootstrap.ts          one-time Superadmin provisioning
src/
  app/
    login/ forgot-password/ reset-password/ invite/ terms/
    app/[[...path]]/           authenticated client portal
    admin/[[...path]]/         Superadmin portal
    api/auth/                 Better Auth endpoints
    api/admin/                restricted administrative actions
    api/portal/               protected client actions
    api/internal/cron/        authenticated job processor
    api/webhooks/manyreach/   disabled until authenticity is verified
  components/                 UI primitives, auth, shell, tables
  features/
    admin/                    clients, packages, audit, system
    portal/                   campaigns, inbox, resources, analytics, usage
    campaign-builder.tsx      draft creation flow
  lib/
    auth.ts access.ts         authentication and tenant resolution
    permissions.ts            effective feature and limit policy
    db.ts locks.ts            pooled MySQL access and leases
    crypto.ts errors.ts       encryption and safe API errors
    manyreach/                adapter, normalization, verified request contract
  server/                     admin, invitation, job and outreach services
tests/                        unit tests and Playwright smoke tests
```

## Local development

Use Node.js 24 and npm. Hostinger's supported runtime list was verified against its official documentation on 2026-09-14. The pinned Next.js release is 16.3.5; Prisma is stable 7.10.0 rather than the Prisma 8 release candidate.

```sh
npm ci
```

Copy `.env.example` to `.env`, fill in a **development** MySQL database and service configuration, then:

```sh
npm run db:generate
npm run db:deploy
npm run bootstrap
npm run dev
```

For a new schema change, use `npm run db:migrate -- --name descriptive_change` with an isolated development database and shadow database privileges. On production, only `npm run db:deploy` applies committed migrations. Never reset production.

Build validation:

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit tests mock provider and database boundaries. Browser smoke tests cover public auth pages and unauthenticated redirects; they do not replace the real-service acceptance test. See [ACCEPTANCE_TEST.md](ACCEPTANCE_TEST.md).

## Database structure

| Models | Purpose |
|---|---|
| User, Session, Account, Verification, RateLimit | Better Auth accounts, cookies, expiry, password hashes, reset tokens, throttling |
| Client, ClientMembership | Workspace identity and membership role |
| Package, PackageFeature, PackageLimit | Database-defined packages and policies |
| ClientPermissionOverride, ClientLimitOverride | Per-client policy exceptions |
| ManyreachClientspace | Unique mapping to an isolated provider clientspace; encrypted key |
| Invitation | Hashed random token, role, expiry, accepted/revoked/sent state |
| AuditLog, ApiLog | Compact administrative/action records and HTTP metadata |
| BackgroundJob | Encrypted temporary payload, attempts, progress, status, lock token |
| UsageSnapshot | Latest resource-count snapshot, not a historical outreach warehouse |
| AppSetting, Lease, RequestBucket, MutationReceipt | Runtime metadata, concurrency ownership, rate budgets, action deduplication |
| Notification, WebhookEvent, ResourceMap | Schema support for later verified capabilities; no webhook ingestion enabled |

Prisma reuses a process-wide client with a five-connection pool. Configure DB TLS according to the database endpoint; certificates are never ignored. Migration SQL creates indexed MySQL tables and relevant foreign keys.

## Authentication and permissions

Public signup is disabled. Invitation acceptance atomically creates the Better Auth credential account and tenant membership and consumes the invitation. An invite to an existing user requires that user to sign in first; the invite cannot reset an existing password. Tokens expire after 48 hours by default and only hashes are stored in Invitation. The outbound mail job temporarily holds the encrypted invitation token until delivery.

Owner and Admin permissions are limited by their package and client overrides. Members can only use granted `.view` permissions. Team access changes are restricted to the owner; Superadmin has separate administrative APIs. Suspension blocks client requests and pending imports; it does **not** automatically stop provider campaigns.

`getEffectivePermission()` gives client overrides precedence over package features. `getEffectiveLimit()` does the same for limits. Missing feature denies; missing limit is zero; `-1` means unlimited. Do not assign `-1` while promising a finite sending allowance to a client.

## Operations and deployment

1. [HOSTINGER_DEPLOYMENT.md](HOSTINGER_DEPLOYMENT.md): GitHub, Node runtime, database, first admin, domain and SSL.
2. [MANYREACH_SETUP.md](MANYREACH_SETUP.md): provider configuration, verified operations, isolation and webhook limitations.
3. [HOSTINGER_CRON_SETUP.md](HOSTINGER_CRON_SETUP.md): one scheduled processor.
4. [BACKUP_AND_RECOVERY.md](BACKUP_AND_RECOVERY.md): MySQL export, encryption-key backup and recovery.
5. [RELEASE_GATES.md](RELEASE_GATES.md): unresolved requirements and live launch gates.

Cron clears API logs after seven days, audit logs after the configured retention (default 90 days), finished/failed jobs after seven days, stale temporary jobs after two days, webhook metadata after seven days, old notifications after 30 days and expired authentication metadata. Never add provider payloads to logs. Diagnose with request metadata in `/admin/system` and job errors in `/admin/jobs`.
