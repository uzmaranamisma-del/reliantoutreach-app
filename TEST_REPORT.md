# Verification report

Checked on 2026-09-14 on Windows with Node.js 24.18.0.

| Check | Result | Scope |
|---|---|---|
| Prisma client generation | Passed | Schema parses and generates Prisma 7.10 client |
| Initial migration generation | Passed | Offline schema-to-SQL generation; not applied to live MySQL |
| TypeScript | Passed | `npm run typecheck` |
| ESLint | Passed, no warnings | `npm run lint` |
| Unit tests | 43 passed across 7 files | Permissions/tenant boundaries, encryption and safe responses, adapter authentication/retries, invitations, jobs, cron and duplicate-write receipts; database/provider mocked |
| Production build | Passed | `npm run build`; Next.js 16.3.5, all pages and route handlers compiled |
| Browser smoke tests | 6 passed | Playwright using installed Microsoft Edge in Chromium mode; desktop and mobile login/reset forms and unauthenticated portal protection |
| Visual checks | Passed for public auth screens | Desktop 1280 × 720 and mobile 390 × 844, no horizontal overflow |
| Hostinger UI inspection | Deploy Web App offered | Actual signed-in Unlimited plan; Node onboarding opened and exited without submitting deployment |

The browser run uses `PLAYWRIGHT_CHANNEL=msedge` because the Playwright-managed Chromium download was not installed locally. CI installs Chromium itself. An earlier browser run exposed an overly broad test alert selector, which was narrowed to the app's actual error alert before the successful run.

These checks do **not** verify production MySQL transactions, live email delivery, real Manyreach resource mutations, external monthly-cap enforcement, webhook authenticity, Hostinger builds/runtime, DNS/SSL, cron execution, concurrency under load or the user's full acceptance scenario. See [ACCEPTANCE_TEST.md](ACCEPTANCE_TEST.md) and [RELEASE_GATES.md](RELEASE_GATES.md).

No real prospect emails or provider reply messages were sent during verification. There are no fake production analytics or demo tenants in the application.
