# Manyreach integration setup and contract

Verified against the official REST OpenAPI v2.5.0 on **2026-09-14** (the spec changelog includes 2026-09-12). This implementation uses REST, not the MCP protocol.

- [Official API explorer](https://api.manyreach.com/api)
- [Official REST specification](https://api.manyreach.com/swagger/docs/v2)
- [Provider call behavior and known deviations](https://mcp.manyreach.com/docs/guides/call-contract)
- [Clientspace concepts](https://mcp.manyreach.com/docs/guides/clientspace-delegation)

## Credentials and tenant isolation

Set `MANYREACH_API_BASE_URL=https://api.manyreach.com/api/v2` and put the agency key in `MANYREACH_API_KEY` in the server environment. V2 uses `X-API-Key`; query-string authentication is not used.

Superadmin maps an existing clientspace or creates one. REST `GET /clientspaces/{id}` returns its key to the server. The application calls `/account` using that key and checks that it identifies the exact clientspace before storing the encrypted key. A unique provider ID prevents mapping the same space to two clients. Every subsequent tenant call uses that clientspace key. There is no fallback to the agency key.

The MCP-only `clientspaceId` argument is **not** sent to REST campaign endpoints. Do not treat it as a REST authorization header or query parameter. Manyreach calls clientspaces “Subaccounts” in its web UI; the REST resource remains `/clientspaces`.

Use a separate real clientspace for acceptance testing. An existing mapped space may already have running outreach; inspect it before making changes. New spaces are created with separate credits, no automatic allocation and zero configured recurring credit allocation. The app does not silently move paid agency credits. Credit allocation must be managed deliberately by Superadmin/provider operations until the monthly-cap design is resolved.

## Verified REST operations used

All paths below are relative to `/api/v2`.

| Resource | Operations |
|---|---|
| Agency/account | GET `/account`, GET/POST `/clientspaces`, GET `/clientspaces/{id}` |
| Campaign | GET/POST `/campaigns`; GET/PATCH/DELETE `/campaigns/{id}`; POST start/pause/copy/archive; GET stats |
| Sequences | GET/POST `/campaigns/{id}/sequences`; GET/POST `/sequences/{id}/followups`; GET/PATCH/DELETE `/followups/{id}` |
| Prospects | GET/POST `/prospects`; GET/PATCH/DELETE `/prospects/{id}`; POST `/prospects/bulk`; GET `/prospects/{id}/messages` |
| Lists | GET/POST `/lists`; GET/PATCH/DELETE `/lists/{id}` |
| Senders | GET/POST `/senders`; GET/PATCH/DELETE `/senders/{id}` |
| Inbox | GET `/messages?type=Reply`; POST `/messages/reply` |

`src/lib/manyreach/contract.json` contains a reduced, machine-readable snapshot of official writable fields, required fields, enums and limits. It is used to build strict Zod request validators. `verified-endpoints.txt` records the official endpoint inventory; not every inventoried endpoint is exposed in this application's UI.

## Contract details

- Pages use `items` plus `pagination.currentPage`, `pageSize`, `totalItems`, `nextCursor`. Campaign list query names include `pageQuery.page`, `pageQuery.limit` and `pageQuery.status`.
- The actual campaign status set includes Draft, Running, Paused, Completed, Archived, Warning, Blocked, Scheduled and Preparing.
- `fromEmails` is a comma-separated string; the server verifies each selected sender against the tenant's connected senders.
- The initial campaign email is its own `subject` and HTML `body`. Follow-ups require an explicit sequence. They do not exist automatically after campaign creation.
- Follow-up delay uses `waitMin` and `waitUnits` (Minutes, Hours, Days).
- The campaign `delayMinSeconds` is seconds. Sender `delayMinMinutes` is minutes. Avoid the deprecated misleading campaign delay field.
- Bulk prospects are posted as `{prospects:[...]}` with no more than 100 rows per request. They merge by email. Client limits conservatively count the batch as potential new prospects; duplicates may therefore cause a safe over-rejection near a limit.
- Manual replies use the original message ID and `sendAsReply:true`; no browser-supplied arbitrary provider message ID is accepted.
- Sender PATCH has a documented omitted-boolean reset caveat. The service reads the current sender and resends all known boolean settings when patching.
- Provider UI changes may take minutes to appear in API list reads. API writes should appear in subsequent API reads. Refresh-before-save prevents many stale edits, but without provider compare-and-swap it cannot eliminate races with a concurrent external edit between GET and PATCH.

The REST spec describes a default 60 requests/minute per organization; elevated agency tiers can have 300, while clientspaces have independent 60/minute buckets. This application conservatively budgets 50 per minute for each clientspace and tracks provider cooldowns. Do not retry 429 immediately. Only bounded idempotent GET retries occur automatically. Authentication/validation errors and ambiguous non-idempotent writes are not automatically retried.

## Webhook status

The verified OpenAPI resource inventory has no webhook management/signature contract. The official help material confirms some notification integrations, but did not establish an authenticatable event schema/signature algorithm suitable for this application.

`POST /api/webhooks/manyreach` therefore returns 503 and **must not be registered as a working webhook**. No guessed signature headers are accepted. To finish this requirement, obtain the official delivery schema, signature header/algorithm, raw-body canonicalization rules, timestamp/replay window, event identifier, tenant identity, retry behavior and configuration mechanism. Then implement verification, event deduplication and tenant-scoped invalidation and run replay/forgery tests before enabling it.

Polling and cron reconciliation are the current Manyreach → ReliantOutreach path. UI polling pauses in background tabs through TanStack Query. Intervals are configurable via the server environment; no permanent WebSocket process is needed.

## Verify synchronization

1. Create/map a test clientspace using Superadmin.
2. Complete its invitation and sign in as its owner.
3. Open a real campaign. Edit its subject, save, refresh and compare to the provider's API result (Superadmin only).
4. Change the subject externally in the test space, then refresh in the app. Account for documented provider list lag.
5. Open an actual reply, read the retrieved prospect history and send a reply only to your approved test recipient. Confirm receipt outside the app.
6. Compare a campaign's selected-date analytics with the official stats response.
7. Verify that an encrypted ID copied from client A produces 404 when requested as client B.

No live synchronization checks have been completed in this delivery.
