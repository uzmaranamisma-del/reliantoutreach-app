# Operational status and release checks

The application is deployed at https://app.reliantoutreach.com from the authorized GitHub repository. This file replaces the outdated pre-deployment checklist.

## September 27 reliability update

- Reply alerts use a dedicated resumable collector and provider-message IDs, separate from dashboard reconciliation. Old messages from before subscription enrollment do not alert. Collection uses the documented paginated read API; large accounts take multiple scheduled runs. It is polling, not a verified real-time webhook.
- Push delivery uses a persistent, deduplicated outbox, retries transient errors, rechecks active membership/session/permission, validates service-owned destinations and sets a 24-hour delivery expiry. Browser receipt deduplication also remains enabled. Neither the browser nor an offline phone offers an absolute delivery guarantee.
- Notification registration exposes errors, reconnect, device removal and a user-triggered test. Existing devices must reopen the app once to bind their subscription to the current login. Signing out removes that login's subscriptions. Expired sessions require signing in again.
- Published monthly capacities are owner-approved managed allowances. Positive allowances permit campaign starts. They are not hard provider cutoffs; zero email entitlement still blocks starts. Monthly usage is a resumable UTC-month campaign-statistics snapshot, explicitly labeled; manual replies may not be included.
- Conversation metadata requires `inbox.manage`; existing write-enabled package/client settings are migrated from `inbox.reply`. CLIENT_MEMBER remains read-only. Inbox groups contacts within the fetched page, resets contact notes, and stores per-user/per-workspace drafts locally for seven days or until sign-out. It does not claim a global conversation index across all provider pages.
- Notification acknowledgments are per user. Existing workspace-level acknowledgments are not propagated to every user.
- Administrator client details include an explicitly confirmed, queued Pause live campaigns action. Suspension alone still only removes portal access; pause progress and failures must be checked in Jobs.
- CI provisions isolated MySQL and separates pure application build from production deployment migrations. Authenticated browser checks exercise tenant isolation, read-only permissions, per-user reads and mobile/desktop inbox behavior without real outreach.
- Encrypted backup and empty-database restore-drill tooling is available. Local recovery testing does not establish that Hostinger production backups are scheduled.

## Production checks still require evidence

1. Hostinger cron must POST `/api/internal/cron/process-jobs` with its configured bearer secret every minute. On September 27, before this update, live System health showed no recorded cron run and three pending jobs. A code push alone cannot create a hosting cron job.
2. Verify VAPID settings, SMTP configuration, a real invitation to an approved test recipient, and closed-app push delivery on an actual enrolled phone. Do not send real outreach as a deployment test.
3. Set up scheduled encrypted production database backups, retain encryption secrets separately, and periodically restore into an isolated database. Restore must never replay pending outgoing jobs blindly.
4. Monitor oldest pending push, expired alerts, reply scan errors, failed jobs and cron freshness in System health. Large accounts and many devices need a measured throughput budget.
5. Superadmin MFA is a future security enhancement; it is not included or claimed by this reliability update.

## Migration note

The original PushSubscription migration used an oversized utf8mb4 composite index. Its endpoint column is now ASCII for clean installs, and the new forward migration applies the same type to existing installations. URL endpoints are ASCII. The new tables are additive and retain existing client/provider data. On a previously FAILED initial push-table migration, inspect its state before resolving/retrying; never mark an unexecuted migration applied.
