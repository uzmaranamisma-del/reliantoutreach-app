# Verification report

Checked on 2026-09-14 and 2026-09-15 on Windows with Node.js 24.18.0.

| Check | Result | Scope |
|---|---|---|
| Prisma client generation | Passed | Schema parses and generates Prisma 7.10 client |
| MySQL migrations | Passed | Initial schema, package catalog, cancelled-job enum draft client status and onboarding result metadata applied to local MySQL |
| TypeScript | Passed | `npm run typecheck` |
| ESLint | Passed, no warnings | `npm run lint` |
| Unit tests | 102 passed across 15 files | Tenant boundaries, safe responses, adapter, invitations, jobs, cron, receipts, package review gate, admin ownership/cancellation/key rotation, enrollment, branding URLs, schedule validation, preview routing/data safety, draft onboarding, agency-key Subaccount resolution and activation prerequisites; database/provider mocked |
| Local MySQL checks | Passed | Competing job claim/cancellation has one winner; active lease excludes another caller and can be reused after release; transaction rollback removes test writes |
| Authenticated local admin | Passed | Real Superadmin login, four persisted package cards and package editor; settings save persisted successfully |
| Production build | Passed | `npm run build`; Next.js 16.3.5, all pages and route handlers compiled |
| Manyreach API contract | Passed | Supplied Swagger 2.0 document v2.5.0: HTTPS host/header authentication, key models and all 90 endpoint-method pairs match the checked manifest |
| Browser smoke tests | 6 passed | Playwright using installed Microsoft Edge in Chromium mode; desktop and mobile login/reset forms and unauthenticated portal protection |
| Visual checks | Passed for public auth screens | Desktop 1280 × 720 and mobile 390 × 844, no horizontal overflow |
| Hostinger UI inspection | Deploy Web App offered | Actual signed-in Unlimited plan; Node onboarding opened and exited without submitting deployment |

The browser run uses `PLAYWRIGHT_CHANNEL=msedge` because the Playwright-managed Chromium download was not installed locally. CI installs Chromium itself. An earlier browser run exposed an overly broad test alert selector, which was narrowed to the app's actual error alert before the successful run.

These checks do **not** verify production MySQL transactions, live email delivery, real Manyreach mutations, external monthly-cap enforcement, webhook authenticity, Hostinger builds/runtime, DNS/SSL, hosted cron, concurrency under load or the full acceptance scenario. See [ACCEPTANCE_TEST.md](ACCEPTANCE_TEST.md) and [RELEASE_GATES.md](RELEASE_GATES.md). The local database test creates uniquely named test records, removes only those records, and refuses non-local database hosts; run with `ALLOW_LOCAL_DB_TEST=yes npx tsx scripts/verify-local-db.ts` (set the environment variable using your shell syntax).

No real prospect emails or provider reply messages were sent during verification. There are no fake production analytics or demo tenants in the application.

Client dashboard preview: authenticated Superadmin view verified across Dashboard, Campaigns, Inbox, Prospects, Lists, Senders, Analytics, Team, Usage, Notifications and Settings. Provider tabs use tenant-bound read-only endpoints; the saved unmapped draft shows an explicit connection-required state. Authorization, provider-ID masking and preview-data tests passed.

## September 15: Sync & Invite verification

Local login recovery: MySQL's cold authentication failed with `ER_CANNOT_RETRIEVE_RSA_KEY` after a server restart. The adapter now accepts a trusted public-key file through `DATABASE_RSA_PUBLIC_KEY`; the local environment points at this MySQL instance's public key. The startup script waits for MySQL and runs an authenticated `SELECT 1` before reporting readiness. Database verification and browser Superadmin sign-in passed; the authenticated platform overview loaded with the saved client and packages.

- Unit tests cover isolated-key scope, exact-name Subaccount resolution from an agency key, cross-client mapping rejection, duplicate sync submission, five data checks before publication, provider/SMTP failure handling, owner access, invite deduplication, campaign pagination/partial-data rejection, tenant-bound status, targeted job execution and safe extended contact/tag fields. Only the resolved isolated key is encrypted and stored.
- `ALLOW_LOCAL_DB_TEST=yes node --conditions=react-server --import tsx scripts/verify-onboarding-db.ts` passed against real local MySQL. Verified activation, snapshot/result persistence, atomic invitation queue creation, repeated-publication deduplication and MySQL JSON-path lookup. Temporary fixtures were removed; no test delivery worker was run and no email was sent.
- Authenticated browser: the three-step wizard advances through active Launch/Growth/Scale to Sync & Invite. Empty-key validation checked; no test client saved. Test Company has the new key/password panel, SMTP status, assigned Growth plan, and no visible permission overrides tab or manual draft activation button.
- Six desktop/mobile public browser smoke tests passed again. Production build and lint passed.
- Hostinger SMTP authentication for `info@reliantoutreach.com` passed without sending an email, and the restarted app reports SMTP configured. The supplied Manyreach key was verified as agency-wide. The app now accepts that key only when exactly one Manyreach Subaccount name matches the client's company and then verifies and stores its isolated key. The saved browser password field was cleared by navigation before the updated flow could be retried, so the real client still has no Manyreach mapping. Live provider synchronization, SMTP delivery, invitation acceptance and the populated client dashboard remain unverified. Source remains local.

## Workspace connection correction

The supplied Swagger defines Workspace and Clientspace as separate isolated account types. Previous onboarding only supported Clientspace. Both types are now accepted directly; agency lookup scans both collections and verifies the resulting isolated key. A migration adds the account type to the unique provider identity. Tests cover direct workspace keys, paged workspace discovery, cross-type ambiguity, missing pages, type-changing replacement rejection, and workspace key rotation. Live synchronization still requires the API key to be entered in the client form.
