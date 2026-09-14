# Release gates and implementation limits

This is **not a declaration of production completion**. The brief's full real-service acceptance scenario has not passed. The GitHub destination is uzmaranamisma-del/reliantoutreach-app. No Manyreach key, MySQL credentials or SMTP credentials were supplied. The owner's signed-in hPanel was inspected: the Unlimited plan offers Deploy Web App and opens Node app onboarding. No deployment was submitted. DNS, TLS, remote database connectivity and cron execution remain unverified. The intended app subdomain is already listed as an existing website.

## Required before launch

1. **Strict monthly email limits.** The verified provider API exposes additive separate-credit allocation, not a proven atomic per-month send cap with downgrade/rollover semantics. Polling and pausing can overshoot. This app fails closed: a finite monthly email limit blocks campaign starts and manual replies. It does not stop previously running provider campaigns. Do not change a running client's package and assume the new sending cap is enforced. Resolve this provider capability and implement authoritative counting/credit policy before selling capped sending plans. Unlimited (`-1`) is appropriate only when the actual agreement is unlimited and credit operations are controlled separately.
2. **Webhook authenticity.** Obtain the official webhook contract and implement verified signed delivery, replay protection, tenant resolution and event deduplication. The placeholder endpoint intentionally returns 503; it is not operational.
3. **Real MySQL integration.** Apply migrations to an actual MySQL database and test authentication schema compatibility, transactional invitation races, job claims, bootstrap uniqueness and multi-instance locks. Mock tests cannot establish these properties in MySQL.
4. **Actual delivery and synchronization.** Run the full scenario in ACCEPTANCE_TEST.md with real test inboxes/clientspaces and explicit confirmation before starting outreach or sending replies.
5. **Deployment verification.** Connect the chosen GitHub repository, use managed Node 24, confirm database access at build/runtime, create the administrator, run cron, map the domain and verify HTTPS/cookie flags.
6. **Operational load/security review.** Measure account concurrency and job throughput on the actual plan, set the provider budget for expected users, test sustained polling and retention at realistic volume, and review the security policy with real auth traffic. The adapter has DB rate budgeting and three cross-process request slots per provider scope; real multi-instance behavior still needs MySQL testing.
7. **Service documents.** Replace the basic workspace-terms page with the owner's actual reviewed service agreement and privacy/acceptable-use documents. Branding is currently fixed to ReliantOutreach; an admin branding-settings editor is not implemented.

## Feature scope still short of the full brief

| Area | Delivered behavior | Remaining work |
|---|---|---|
| Dashboard | Real resource counts from cron, five live campaigns, activity | Full all-client sent/reply/positive-reply aggregates, sender-health analysis and global date-filtered charts |
| Campaign builder | Seven steps; saves initial email/settings and optional follow-ups as real drafts | Prospect enrollment inside the builder; existing-list enrollment; full schedule/day/time editor; fully resumable multi-step provider-write recovery |
| Campaign editor | Subject/body/name/daily-limit, sender-email selection, timezone/day/time scheduling and tracking controls with refresh/version check | Rich sender picker beyond the first 1,000 senders; provider-atomic conflict protection is unavailable |
| Sequences | Create sequence, add/edit follow-ups; delete service implemented | Delete/reorder sequence and follow-up UI; conditional branch editor |
| Prospects/lists | Live CRUD and CSV import to chosen campaign/list | Bulk selection actions, existing-prospect assignment, remove-from-list UI, tags/suppression/validation screens |
| Inbox | Replies, supported category filters, first 100 messages per prospect, real reply request | Full cursor paging through message history, richer status management and meeting classification |
| Senders | SMTP/IMAP creation, safe output, basic limit/name edit, deletion | Rich warmup/settings editor and error/health analytics |
| Packages | Real persisted policy, overrides, immediate per-request checks | Monthly send-cap resolution; reconciliation after external provider resource creation can detect but cannot prevent external edits |
| Team/admin users | Invitations, members, member removal, users list, server access-change endpoints | Complete role-change/disable UI, full Superadmin team ownership controls, arbitrary internal Superadmin provisioning flow |
| Clients | Creation/mapping, package/overrides, suspension, impersonation | Full editor UI, API-key rotation UI and provider orphan reconciliation after partial creation failures |
| Data tables | Server pagination, some provider search/filter, page-local sorting | Server sorting where supported, full cursor flows for all very large tables; package editor listing is limited to first 100 packages |
| Background jobs | DB claims/leases, retry, bounded import groups, cleanup | Real multi-instance/load verification, cancellation/review UI; no exactly-once guarantee across MySQL and external side effects |
| Notifications/settings | Schema, fixed branding, account details | Notification delivery UI and configurable branding/application settings |
| Testing | Security/adapter/invitation/job/cron unit tests, public-page browser smoke tests | Full database-backed and live-provider acceptance tests |

No unsupported feature has been simulated with random analytics. Unimplemented capabilities are omitted, restricted or called out above. Completing these gaps is additional implementation work, not something credentials alone will fix.

