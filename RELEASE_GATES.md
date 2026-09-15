# Release gates and implementation limits

This is **not a declaration of production completion**. The brief's full real-service acceptance scenario has not passed. The owner asked to keep code local; no GitHub push or deployment was submitted. A real local MySQL instance now runs the application, with migrations and Superadmin login verified. Manyreach, SMTP and production MySQL credentials remain unavailable. hPanel offers managed Node onboarding, but DNS, TLS, remote database connectivity and hosted cron remain unverified.

## Required before launch

1. **Strict monthly email limits.** The verified provider API exposes additive separate-credit allocation, not a proven atomic per-month send cap with downgrade/rollover semantics. Polling and pausing can overshoot. This app fails closed: a finite monthly email limit blocks campaign starts and manual replies. It does not stop previously running provider campaigns. Do not change a running client's package and assume the new sending cap is enforced. Resolve this provider capability and implement authoritative counting/credit policy before selling capped sending plans. Unlimited (`-1`) is appropriate only when the actual agreement is unlimited and credit operations are controlled separately.
2. **Webhook authenticity.** Obtain the official webhook contract and implement verified signed delivery, replay protection, tenant resolution and event deduplication. The placeholder endpoint intentionally returns 503; it is not operational.
3. **Production MySQL integration.** Local migrations, authentication, competing job claim/cancellation, lease exclusion/release and transaction rollback passed against MySQL. Still test transactional invitation races, bootstrap uniqueness and sustained multi-instance operations on the hosting database.
4. **Actual delivery and synchronization.** Run the full scenario in ACCEPTANCE_TEST.md with real test inboxes/clientspaces and explicit confirmation before starting outreach or sending replies.
5. **Deployment verification.** Connect the chosen GitHub repository, use managed Node 24, confirm database access at build/runtime, create the administrator, run cron, map the domain and verify HTTPS/cookie flags.
6. **Operational load/security review.** Measure account concurrency and job throughput on the actual plan, set the provider budget for expected users, test sustained polling and retention at realistic volume, and review the security policy with real auth traffic. The adapter has DB rate budgeting and three cross-process request slots per provider scope; real multi-instance behavior still needs MySQL testing.
7. **Service documents and package limits.** Supply reviewed service/privacy/acceptable-use documents and publish their HTTPS links in Settings. Launch, Growth and Scale are active with owner-approved unlimited technical limits (September 15); their published monthly email capacities remain finite. LinkedIn Outreach is catalogued as a managed service; it has no native LinkedIn automation.

## Feature scope still short of the full brief

| Area | Delivered behavior | Remaining work |
|---|---|---|
| Dashboard | Resumable sync of resource counts and all-campaign sent/reply/open/bounce totals, five live campaigns, activity | Sender-health analysis and global date-filtered charts |
| Campaign builder | Seven steps, initial email, follow-ups, sender selection, day/time schedule, CSV or existing-list enrollment into drafts | Fully resumable multi-step provider-write recovery |
| Campaign editor | Subject/body/name/daily-limit, sender-email selection, timezone/day/time scheduling and tracking controls with refresh/version check | Rich sender picker beyond the first 1,000 senders; provider-atomic conflict protection is unavailable |
| Sequences | Create/edit/delete sequences, conditional branch editor, add/edit/delete follow-ups | Reordering requires a verified provider capability, which is unavailable in the checked contract |
| Prospects/lists | Live CRUD, paginated list members, contact/custom-field/tag/validation details, CSV import and enrollment | Remove-from-list UI, tag editing/suppression/validation actions |
| Inbox | Replies, category filters, cursor-paged prospect message history, real reply request | Richer status management and meeting classification |
| Senders | SMTP/IMAP creation, safe settings/warmup details and tag names, basic limit/name edit, deletion | Rich warmup/settings editor and error/health analytics |
| Packages | Four website packages with setup/monthly fees, service descriptions, terms, active email plans with unlimited technical allowances; client price/services display | Monthly send-cap resolution; external provider edits cannot be prevented |
| Team/admin users | Invitation revoke, member removal/role editor, Superadmin ownership/access editor, user enable/disable | Arbitrary internal Superadmin provisioning flow |
| Clients | Three-step onboarding without a permissions step; isolated API key verification, resumable Sync & Invite with automatic activation, delivery status, draft saving, package assignment, suspension, impersonation and contact editor | Provider orphan reconciliation after partial creation failures |
| Data tables | Package search/server paging, provider-resource cursors, some provider search/filter, page-local sorting | Server sorting where supported and remaining large-table/picker refinements |
| Background jobs | DB claims/leases, bounded imports/enrollment, cleanup, queued-job cancellation; local claim race verified | Hosted multi-instance/load verification; no exactly-once guarantee across MySQL and external side effects |
| Notifications/settings | Workspace job-result notifications with shared acknowledgments; product name, color, support and policy-link settings | Custom logo and complete auth/email template branding; notification generation requires cron |
| Testing | 91 unit tests, local MySQL concurrency/rollback checks, public browser smoke tests and authenticated admin checks | Full database-backed and live-provider acceptance scenario |

No unsupported feature has been simulated with random analytics. Unimplemented capabilities are omitted, restricted or called out above. Completing these gaps is additional implementation work, not something credentials alone will fix.

