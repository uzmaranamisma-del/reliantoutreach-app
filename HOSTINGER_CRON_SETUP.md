# Hostinger Cron setup

Use **one custom cron job** that POSTs to the managed application. Do not run a separate Node worker.

## Endpoint

```text
POST https://app.reliantoutreach.com/api/internal/cron/process-jobs
Authorization: Bearer <CRON_SECRET>
```

Missing/wrong authorization returns 401 and performs no work. GET is not an execution endpoint. Use HTTPS and keep the secret out of query strings.

## hPanel configuration

Open the hosting site's **Advanced → Cron Jobs** and choose a custom command. Start with every minute (`* * * * *`) if your plan allows it; otherwise use the shortest supported interval, for example every five minutes. One-minute processing improves invitation delivery and import throughput. Hostinger schedules cron in UTC; one-minute schedules do not need a local timezone conversion. [Official cron guide](https://support.hostinger.com/en/articles/1583465-how-to-set-up-a-cron-job-at-hostinger)

Example custom command (replace the domain and secret in hPanel):

```sh
curl --fail --silent --show-error --max-time 240 --request POST --header 'Authorization: Bearer REPLACE_WITH_CRON_SECRET' 'https://app.reliantoutreach.com/api/internal/cron/process-jobs'
```

This uses the hosting account's curl command, not a daemon. Do not store the live command in GitHub. If the cron UI does not support this custom command or curl is unavailable, confirm the supported HTTP invocation with Hostinger before launch. Do not fabricate an extra server as a workaround.

## Work performed

- Enqueue reconciliation for up to ten active clients using a persisted cursor and 15-minute deduplication slots.
- Claim up to five due jobs using conditional database updates, a unique worker token and a processor lease.
- Send invitation email jobs through SMTP.
- Process one group of at most 100 rows per import job, persisting progress and rechecking current tenant status, membership, permission and capacity before each group.
- Refresh small resource-count usage snapshots and mapping sync timestamps.
- Run metadata retention cleanup.
- Publish terminal job results as workspace notifications. Process notification backlog in bounded, deduplicated groups.

The processor stops beginning new jobs after roughly 35 seconds. Individual provider requests have 12-second timeouts and safe GET retries, so an in-progress job can exceed that budget; the example HTTP timeout is 240 seconds. Verify the plan supports this request duration. The processor lease lasts 240 seconds and an import tenant lease lasts 180 seconds. Jobs stuck in processing for over five minutes are marked failed for review, **not automatically replayed**. CSV/list enrollment uses at most 100 rows per group; explicitly selected prospects use one verified prospect per group to bound API calls. Measure this conservative throughput before accepting large imports.

Temporary provider errors can schedule exponential-backoff retries. Ambiguous writes and failed email delivery require review. SMTP and provider API calls are not part of a distributed transaction; exactly-once external side effects are not claimed. Review the real state before re-submitting an interrupted import/reply.

## Verify

1. Save the cron job in hPanel.
2. Execute the same authenticated HTTP request manually from a trusted terminal or hPanel's run/test action if available. Expect HTTP 200 with `{"processed":N}`.
3. Repeat without Authorization; expect 401.
4. Open `/admin/system`; verify Last cron run advances. Open `/admin/jobs` to check job progress and failures.
5. Queue one invitation to your own test mailbox and a small CSV in a dedicated test workspace. Confirm actual email delivery and real provider prospects.
6. Check hPanel cron output/logs where the panel exposes them. The application also records last run and job status, so empty curl output does not prove success.

Do not expose this endpoint through a public “run cron” button. Rotate CRON_SECRET in both application environment and hPanel command together. Job throughput at this conservative batch size must be measured before importing large customer lists.
