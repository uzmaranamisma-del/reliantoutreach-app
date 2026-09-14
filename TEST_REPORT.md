# Verification report

Checked on 2026-09-14 on Windows with Node.js 24.18.0.

| Check | Result | Scope |
|---|---|---|
| Prisma client generation | Passed | Schema parses and generates Prisma 7.10 client |
| MySQL migrations | Passed | Initial schema, package catalog, cancelled-job enum and draft client status applied to local MySQL |
| TypeScript | Passed | `npm run typecheck` |
| ESLint | Passed, no warnings | `npm run lint` |
| Unit tests | 74 passed across 12 files | Tenant boundaries, safe responses, adapter, invitations, jobs, cron, receipts, package review gate, admin ownership/cancellation/key rotation, enrollment, branding URLs, schedule validation, draft onboarding and activation prerequisites; database/provider mocked |
| Local MySQL checks | Passed | Competing job claim/cancellation has one winner; active lease excludes another caller and can be reused after release; transaction rollback removes test writes |
| Authenticated local admin | Passed | Real Superadmin login, four persisted package cards and package editor; settings save persisted successfully |
| Production build | Passed | `npm run build`; Next.js 16.3.5, all pages and route handlers compiled |
| Browser smoke tests | 6 passed | Playwright using installed Microsoft Edge in Chromium mode; desktop and mobile login/reset forms and unauthenticated portal protection |
| Visual checks | Passed for public auth screens | Desktop 1280 × 720 and mobile 390 × 844, no horizontal overflow |
| Hostinger UI inspection | Deploy Web App offered | Actual signed-in Unlimited plan; Node onboarding opened and exited without submitting deployment |

The browser run uses `PLAYWRIGHT_CHANNEL=msedge` because the Playwright-managed Chromium download was not installed locally. CI installs Chromium itself. An earlier browser run exposed an overly broad test alert selector, which was narrowed to the app's actual error alert before the successful run.

These checks do **not** verify production MySQL transactions, live email delivery, real Manyreach mutations, external monthly-cap enforcement, webhook authenticity, Hostinger builds/runtime, DNS/SSL, hosted cron, concurrency under load or the full acceptance scenario. See [ACCEPTANCE_TEST.md](ACCEPTANCE_TEST.md) and [RELEASE_GATES.md](RELEASE_GATES.md). The local database test creates uniquely named test records, removes only those records, and refuses non-local database hosts; run with `ALLOW_LOCAL_DB_TEST=yes npx tsx scripts/verify-local-db.ts` (set the environment variable using your shell syntax).

No real prospect emails or provider reply messages were sent during verification. There are no fake production analytics or demo tenants in the application.
