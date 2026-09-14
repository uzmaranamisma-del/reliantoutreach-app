# ReliantOutreach delivery guide

This is a local implementation checkpoint, not production completion. Full live-service acceptance is blocked by missing configuration and the implementation gaps in [RELEASE_GATES.md](RELEASE_GATES.md). No production website was changed, no invitation was sent, and no campaign or reply was sent.

## 1. What was built

One Next.js app with a client portal and Superadmin portal, Better Auth, MySQL/Prisma, packages and overrides, invitations, a server-only Manyreach adapter, campaign and resource management, inbox replies, analytics, and database jobs invoked by cron. See the implemented-feature inventory in [README.md](README.md) and its explicit counterpart in [RELEASE_GATES.md](RELEASE_GATES.md).

## 2. Final folder structure

The repository root contains package.json, the lockfile, configuration and operations documents. `src/app` contains pages and API handlers; `src/features` contains portal/admin interfaces; `src/lib` contains policy, authentication and the provider adapter; `src/server` contains services; `prisma` contains the schema and migration; `scripts` contains bootstrap; `tests` contains checks. The full tree is in README.

## 3. Database structure

MySQL stores identity/session records, clients/memberships, packages/features/limits, overrides, encrypted clientspace mappings, invitations, audit/API metadata, temporary jobs, usage snapshots, request budgets and locks. It does not mirror the provider's entire outreach database. See the model table in README and `prisma/schema.prisma`.

## 4. Environment variables

Copy `.env.example` to `.env` locally, or enter the same keys in the Node app's hPanel environment settings. Configure the public HTTPS origin, MySQL URL/TLS, independent authentication/encryption/cron secrets, agency API key and transactional SMTP credentials. The deployment guide lists exact names and secret generation. Never commit `.env`.

## 5. Manyreach setup

Use the agency API key only on the server. The client-creation workflow maps or creates an isolated clientspace, verifies its key scope using `/account`, and encrypts the client key. Client requests never fall back to the agency key. Follow [MANYREACH_SETUP.md](MANYREACH_SETUP.md). Strict monthly sending caps remain a launch blocker.

## 6. First Superadmin

Set `BOOTSTRAP_EMAIL`, `BOOTSTRAP_PASSWORD` (16–128 characters) and `BOOTSTRAP_NAME` temporarily. After configuring a reachable MySQL database, run:

```sh
npm ci
npm run db:generate
npm run db:deploy
npm run bootstrap
```

Remove those three temporary variables afterward. Bootstrap is one-time. There is no hardcoded login or public signup.

## 7. Deploy through hPanel

The actual Unlimited account was inspected and offers **Add website → Deploy Web App**. Use a managed Next.js app with Node 24, repository root, `build:hostinger` and `npm start`. Follow [HOSTINGER_DEPLOYMENT.md](HOSTINGER_DEPLOYMENT.md), including the existing-subdomain migration precaution. Do not use PHP hosting to execute Next.js or install a VPS stack.

## 8. Connect GitHub

Create/select a private repository, make this project its root, push the supplied source, and connect that repository and branch in hPanel. The deployment guide gives the exact git commands with a placeholder remote. The selected repository is https://github.com/uzmaranamisma-del/reliantoutreach-app; it was empty and public when inspected. Review and enable the included GitHub Actions checks before production merges.

## 9. Create/configure MySQL

Use hPanel's database management to create a dedicated database and user. Retain the full prefixed names, URL-encode credentials in `DATABASE_URL`, and verify the actual database hostname. Apply committed migrations with `npm run db:deploy`. For local migration/bootstrap, allow only the development computer's IP in Remote MySQL, then remove that entry. Runtime and migration TLS configuration are documented separately in the deployment guide.

## 10. Configure the domain

`app.reliantoutreach.com` already exists in the owner's website list. Inspect/back up its current contents before migration. Use the managed app's domain connection flow and the exact DNS records hPanel supplies. Do not guess an IP or overwrite the apex site's records.

## 11. Configure SSL

Wait for hPanel's managed certificate to be active, enforce HTTPS where available, set `NEXT_PUBLIC_APP_URL` to the final HTTPS origin, and redeploy. Verify HTTP-to-HTTPS redirects, certificate hostname and Secure/HttpOnly/SameSite session cookies. These checks have not yet been run against the hosted app.

## 12. Configure cron

Create one once-per-minute hPanel custom cron command that POSTs to `/api/internal/cron/process-jobs` with `Authorization: Bearer <CRON_SECRET>`. [HOSTINGER_CRON_SETUP.md](HOSTINGER_CRON_SETUP.md) contains the complete curl command, schedule, recovery and verification instructions. The app processes bounded database jobs; no permanent worker is required.

## 13. Configure the webhook

Do not configure it yet. `/api/webhooks/manyreach` deliberately returns 503 until the provider's official authenticity and event contract is verified and implemented. Scheduled polling is implemented. See MANYREACH_SETUP and RELEASE_GATES for the exact unresolved requirements.

## 14. Test synchronization

Follow [ACCEPTANCE_TEST.md](ACCEPTANCE_TEST.md): use a dedicated real clientspace and recipient, create the package/client/invite, accept the invitation, verify tenant isolation, edit a campaign and verify it in the provider after refresh, inspect a genuine reply, confirm/send a reply, inspect real analytics and verify a package change. Finite monthly cap sending cannot pass this scenario until the documented capability gap is resolved. Public-page browser tests are not proof of this flow.

## 15. Update production later

Use a feature branch and passing checks. Back up MySQL before schema changes, review migration SQL, apply `prisma migrate deploy`, and deploy through the selected GitHub branch. Monitor managed logs and `/admin/system`. See [BACKUP_AND_RECOVERY.md](BACKUP_AND_RECOVERY.md) for restoration and rollback. Never run migration reset in production.

## 16. Troubleshoot errors

The deployment guide's symptom table covers database/TLS, builds, bootstrap, login, invitations, API mapping, 429 cooldowns, imports, cron, domain routing and the intentional webhook/monthly-cap restrictions. Inspect sanitized application logs and job state; never share raw keys or provider message bodies in support logs.

