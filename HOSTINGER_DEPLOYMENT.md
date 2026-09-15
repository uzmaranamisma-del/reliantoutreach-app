# Hostinger deployment

This application is a **single Node.js Web App**. These instructions do not require a VPS, Docker, Nginx, Redis, PostgreSQL, root access or a separate worker. Deployment has not been performed in the owner's account.

## 1. Confirm the managed runtime

Account check on 2026-09-14: the owner's signed-in hPanel showed the Unlimited plan, an enabled **Add website → Deploy Web App** option, and Node app onboarding. The onboarding was exited without submitting a domain or deployment. `app.reliantoutreach.com` is already listed as an existing website. Back up and inspect that site before choosing a migration/replacement procedure; do not create a duplicate or change its routing blindly. Runtime selection, build limits and database connectivity still require deployment verification.

Open hPanel → Websites → Add Website. Confirm that **Node.js Web App / Deploy Web App** is available on the actual plan. The word “Unlimited” is not sufficient to establish eligibility. Hostinger currently lists managed Node.js on Business Web Hosting and Cloud plans and supports Node 24 and Next.js. If the option is absent, ask Hostinger to confirm managed Node eligibility for your subscription; do not switch this project to a VPS. [Official managed app instructions](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/)

## 2. Create the GitHub repository

Create a private GitHub repository under your chosen account or organization. Use this project folder as the repository root, so `package.json` is at the root. Do not commit `.env`, `node_modules`, `.next`, database exports, logs or live keys. The supplied `.gitignore` excludes these.

From this folder on your development computer:

```sh
git init
git add .
git commit -m "Add ReliantOutreach application"
git branch -M main
git remote add origin https://github.com/YOUR-OWNER/YOUR-REPOSITORY.git
git push -u origin main
```

The selected repository is https://github.com/uzmaranamisma-del/reliantoutreach-app. It was empty and public when inspected. Use that exact remote in the command above. Require successful CI before deployment; publishing source does not establish production readiness.

## 3. Create the MySQL database and user

In the applicable website's hPanel database tools, open **Databases → Management / MySQL Databases**, create a dedicated database and its dedicated user, and retain the exact generated names (including the hosting prefix). Use a strong generated password and give this user privileges on this database only. [Official database creation guide](https://www.hostinger.com/support/1583542-how-to-create-a-new-mysql-database-in-hostinger/)

If the managed app's panel does not expose the database tools, use the database tools included with the hosting subscription or ask Hostinger which database endpoint the Node app should use. Do not assume `localhost` reaches the database from a managed build or runtime.

Set the supplied hostname, port, user and database in:

```text
DATABASE_URL=mysql://USERNAME:URL_ENCODED_PASSWORD@DATABASE_HOST:3306/DATABASE_NAME
```

URL-encode reserved characters in the username/password. `DATABASE_SSL=true` enables certificate-verified TLS in the runtime driver. The migration CLI uses the Prisma connection URL; if the endpoint requires TLS parameters or a CA, configure those according to Prisma's MySQL connection documentation as well. Confirm both build-time migration and runtime connectivity.

For a one-time migration/bootstrap from your computer, use Hostinger Remote MySQL to allow **only your current IP**, connect with the remote endpoint and remove that allowlist entry afterward. Do not open the database to all IPs.

## 4. Configure secrets

Copy the names from `.env.example` into hPanel's Node app environment settings. Set production values before the first deployment:

| Variable | Value |
|---|---|
| NODE_ENV | `production` |
| NEXT_PUBLIC_APP_URL | `https://app.reliantoutreach.com` (or the actual temporary HTTPS origin until domain setup) |
| DATABASE_URL, DATABASE_SSL | MySQL connection and TLS choice |
| AUTH_SECRET | At least 32 random characters |
| ENCRYPTION_KEY | 32 random bytes encoded as exactly 64 hex characters |
| MANYREACH_API_BASE_URL | `https://api.manyreach.com/api/v2` |
| MANYREACH_API_KEY | Agency API key; server-side only |
| SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD | Transactional email account settings |
| SMTP_FROM_EMAIL, SMTP_FROM_NAME | Verified sender and `ReliantOutreach` |
| CRON_SECRET | Independent high-entropy secret |
| INVITATION_EXPIRY_HOURS | `48` unless you intentionally change it |
| AUDIT_RETENTION_DAYS, API_LOG_RETENTION_DAYS | `90`, `7` by default |
| POLL_INBOX_SECONDS, POLL_CAMPAIGNS_SECONDS, POLL_DASHBOARD_SECONDS | `15`, `25`, `45` by default |
| BOOTSTRAP_EMAIL, BOOTSTRAP_PASSWORD, BOOTSTRAP_NAME | Temporary first-admin setup only |

Generate independent secrets locally, for example `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Transfer them directly into your secret storage/hPanel; do not put them in issue descriptions, build logs or this document. The only `NEXT_PUBLIC_` value is the public origin. SMTP uses TLS on port 465 or required STARTTLS on other configured ports; certificate checks stay enabled.

## 5. Apply production migrations and create the first Superadmin

Preferred controlled setup: from this project on your development computer, set `.env` to the reachable Hostinger database, then run:

```sh
npm ci
npm run db:generate
npm run db:deploy
npm run bootstrap
```

Bootstrap requires a password of 16–128 characters, a valid email and a name. It stores a Better Auth scrypt hash. A unique `bootstrap.completed` setting and an admin-existence check make the setup one-time and race-safe. Remove the three `BOOTSTRAP_*` variables immediately afterward. Use the normal password-reset flow if access is later lost; do not delete the bootstrap marker to create repeated administrators.

Hostinger documents that npm runs during managed builds and may not be available through SSH. Do not rely on an SSH npm shell. If local remote-DB access is unavailable, use a reviewed one-time managed **build:bootstrap** build script added to `package.json` as:

```json
"build:bootstrap": "prisma migrate deploy && tsx scripts/bootstrap.ts && npm run build"
```

Select it once in hPanel with the temporary bootstrap variables. After success, remove those variables and return the build command to `build:hostinger` (or `build` with controlled external migration). The one-time script intentionally fails if used a second time. If the account only offers predefined build commands, confirm with Hostinger how custom package scripts are selected; do not invent root/worker access.

## 6. Connect GitHub and deploy

In hPanel, add the Node.js Web App, choose GitHub, authorize only the intended repository, select the repository and production branch `main`, and use:

```text
Framework: Next.js
Node: 24.x
Root: repository root
Install: npm ci (or Hostinger's npm install equivalent)
Build script: build:hostinger
Start: npm start
Build output: .next (when requested by the Next.js preset)
```

`build:hostinger` runs `prisma migrate deploy` before `npm run build`. A migration failure stops deployment. With a separate reviewed migration procedure, use `build` instead. Do not choose static export or set output to `out`; this app requires server rendering and route handlers.

Deploy and inspect the managed build output. Confirm Prisma generation, migrations and Next compilation succeed. Runtime `npm start` uses Hostinger's provided `PORT`. Do not manually install a process manager. After GitHub integration, pushes to the selected branch trigger managed deployment. [Official deployment behavior](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/)

## 7. Connect the domain and SSL

Use the Node app's **Connect domain / Change domain** flow and enter `app.reliantoutreach.com`. Follow the specific DNS records hPanel displays; do not guess an IP or CNAME target. Keep the apex marketing site intact. If an existing site already uses the subdomain, back it up and arrange the migration before changing its routing. [Official Node custom-domain flow](https://www.hostinger.com/support/how-to-connect-a-custom-domain-to-a-node-js-application/)

Wait for DNS and managed SSL to become active. Enable HTTPS enforcement in the available hPanel security/SSL settings. Set `NEXT_PUBLIC_APP_URL` to the final **HTTPS** origin and redeploy. Verify HTTP redirects to HTTPS, the certificate covers the subdomain, and session cookies have Secure, HttpOnly and SameSite attributes. The application sends HSTS; that header alone does not prove the first HTTP request redirects. No SSL or DNS setup has been verified in your account yet.

## 8. Configure cron and provider access

Follow [HOSTINGER_CRON_SETUP.md](HOSTINGER_CRON_SETUP.md) and [MANYREACH_SETUP.md](MANYREACH_SETUP.md). Do not enable the disabled webhook route. In `/admin/system`, check MySQL, agency API connectivity, last cron run and failed jobs.

## 9. Verify before inviting paying clients

Run [ACCEPTANCE_TEST.md](ACCEPTANCE_TEST.md) in a dedicated real test clientspace and test recipient inbox. Verify login, administrator isolation, invitations, persistence of campaign edits, genuine replies, analytics, package changes, cron authentication and tenant IDOR protection. Confirm the unresolved items in [RELEASE_GATES.md](RELEASE_GATES.md) have been implemented and reviewed before calling this production complete.

## 10. Update production

Make changes on a feature branch, run CI, export the database before schema changes, review migration SQL and merge only passing changes into the branch connected to hPanel. Use `prisma migrate deploy`, never `migrate reset`. Prefer additive migrations so a previous application revision can run during rollback. Monitor deployment logs and `/admin/system` after each update.

## Troubleshooting

| Symptom | Check |
|---|---|
| Node app option missing | Actual plan eligibility; hPanel access alone does not prove Node support |
| Database connection fails | Correct prefix, hostname, URL encoding, network allowlist and TLS configuration |
| Build fails at migration | Migrations committed; migration user privileges; build has DB network access |
| Bootstrap fails | Missing/invalid temporary variables or setup already completed; do not reset production |
| Login reports an error | AUTH_SECRET, exact public origin, database migrations, session cookies and throttling |
| Invitation never arrives | SMTP credentials/TLS/from address, cron last run, job error and spam folder |
| API health error | Agency key/plan; mapping key scope; current provider outage; sanitized status logs |
| Client sees empty lists after an external edit | Provider UI-to-API updates can lag; use by-ID reads and refetch |
| 429 response | Wait for the provider cooldown; reduce polling/users on the same clientspace |
| Monthly capped package cannot start | Intentional fail-closed policy pending strict provider enforcement |
| Import failed/interrupted | Inspect progress; reconcile with actual prospects before reimporting; failed payloads are removed |
| Existing campaigns continue after suspension | Suspension is access control; pause running campaigns separately |
| 403 after redeployment | Verify managed routing in hPanel; Hostinger regenerates managed routing on redeploy |
| Webhook returns 503 | Expected until an official authenticity contract is implemented |

Never copy raw provider response bodies or credentials into support logs.

