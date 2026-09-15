# Real-service acceptance test

Run this only with an isolated test clientspace and mailboxes you own or have authorization to contact. The developer did not send outreach or transactional emails as part of this build. Record evidence in a private location; do not put credentials or private message bodies in GitHub.

## Infrastructure and identity

1. Verify the chosen Hostinger plan exposes managed Node.js Web Apps and the app uses Node 24.
2. Apply committed MySQL migrations. Confirm a second `prisma migrate deploy` is a no-op.
3. Run bootstrap once. Confirm a second attempt fails and no additional admin is created.
4. Visit the HTTPS login page. Sign in as Superadmin; verify `/admin` loads and session cookies are Secure, HttpOnly and SameSite.
5. Log out. Verify protected APIs return 401 and private pages redirect. Test invalid login throttling.
6. Test password reset to your own mailbox, token expiry/reuse and revocation of previous sessions.

## Required primary scenario

1. Superadmin creates a database-defined Growth package with campaign view/edit, inbox view/reply, analytics view and the desired limits. **A finite monthly email cap currently prevents real sending; resolve RELEASE_GATES.md before claiming this scenario works for a capped package.**
2. Create ABC Automation with owner details and timezone.
3. Map/create its real Manyreach clientspace and verify it is uniquely assigned.
4. Assign Growth, queue the invitation, invoke cron, and confirm the branded email arrives.
5. Open the invitation, create the account with password confirmation and agreed terms, then sign in.
6. Verify that only ABC data appears. Repeat with a second client and try ABC resource identifiers in the second client's protected API; expect 404/403.
7. Open a real draft campaign, change the subject and save.
8. Read it independently from the provider as Superadmin, then reload in ReliantOutreach; confirm the exact new subject remains.
9. Change the provider record between load and save; expect a conflict instead of a blind overwrite where the preflight detects the change.
10. Read an actual incoming reply and its history.
11. Confirm and send one reply to your approved test recipient; confirm receipt in that recipient's mailbox, then refresh the history.
12. Compare campaign analytics with the provider stats endpoint for identical dates.
13. Change the package/permission override in Superadmin. On the next request, verify the new permissions/limits apply without a logout.

## Additional mutations

- Create/edit a campaign draft, choose a connected sender, add/edit follow-ups and import a small CSV. Verify each result in Manyreach.
- Confirm the start modal shows the correct campaign, prospect count and senders. Only then approve a test start. Pause and verify actual provider state.
- Verify sender #31 is rejected when the limit is 30; repeat with two concurrent creation requests.
- Verify restricted Member cannot perform a write even by calling the API directly.
- Test CSV quoted values, invalid emails, duplicate emails, empty files, oversize files and limit changes during a pending import. Confirm the maximum provider batch is 100.
- Suspend a client during an import; verify later chunks stop. Verify the documented distinction between access suspension and existing provider campaign execution.
- Accept/revoke/resend/expire invitations; try concurrent reuse and verify a single membership/account outcome.
- Impersonate a client; confirm a visible banner, audit entry and expiry/return behavior.

## Cron, recovery and maintenance

- Wrong/missing cron secret returns 401 with no new work.
- Two concurrent processors must not execute the same job.
- Simulate a transient read error/429; verify delayed retries. Simulate an ambiguous write timeout; verify no blind automatic resend.
- Confirm completed/failed import payloads are erased and retention cleans old metadata.
- Restore a backup in a private staging environment and reconcile external side effects before enabling jobs.
- Verify DNS, SSL, HTTP→HTTPS redirection, build-triggered GitHub deployment and post-deployment login.
- Webhook delivery tests are blocked until the official authentication contract is implemented.

The application's release status remains incomplete until required gaps are implemented and these real-service checks pass with recorded evidence.
