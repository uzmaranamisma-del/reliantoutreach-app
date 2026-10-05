# ReliantOutreach mobile

Native Expo / React Native app for Android and iPhone, connected to the existing backend. Three primary tabs: Inbox, Stats and Plans. Account settings contain appearance and notification controls.

## Delivered in source

- Branded login, secure signed session storage and client workspace selection.
- Superadmins can use their own active main Manyreach account in the same client interface. The workspace owner email must match their login email and its verified connection must be `organization`. Selecting it creates an ordinary owner membership, subject to team capacity; existing disabled memberships remain blocked. No admin dashboard is added to the mobile app. This requires deploying the mobile backend, but no new APK for this access change.
- Virtualized inbox, latest loaded reply previews, unread/starred filters and scoped search.
- Chat-style conversation, automatically paginated history, stable message keys and keyboard-aware composer.
- Manual replies through the existing Manyreach integration, with confirmation and duplicate-submission protection. Uncertain responses keep the draft and ask the user to check the conversation.
- Actual package catalog, active-plan badge, upgrade requests, cancellation and order status history. Administrators review requests on the existing client detail page.
- Real statistics, with separate monthly allowance and all-time snapshot labels.
- Native visible push through Expo → FCM/APNs, a durable server queue, token rotation, receipts, backoff and stable collapse identifiers.
- Dark/light themes, bundled brand fonts, safe areas, request cancellation and in-memory query caching.

The Expo account is connected to `@reliantoutreach-team/reliantoutreach-team` (project ID `feb20780-3420-405b-bc6e-69f7b6e608d9`). Android preview build `a3b03fdb-35a1-4ec7-b5c5-fe132b81c68b` **succeeded on 2026-10-05**. The APK was downloaded to the task outputs as `ReliantOutreach-1.0.0-preview.apk`. Source/export output alone is not an APK/IPA. Firebase and Apple configuration and real closed-app delivery checks remain pending. The backend changes have not been deployed or migrated by this mobile implementation task; the live mobile context endpoint returned HTTP 404 on 2026-10-05. Physical-device installation and runtime checks are still pending.

For subsequent Android APK builds on Windows, run `powershell.exe -ExecutionPolicy Bypass -File .\build-android.ps1` from this directory. It uses an absolute `EAS_PROJECT_ROOT` and `.easignore` so only this independent mobile project is uploaded, excluding the parent server and local credentials. Expo manages the Android signing key created for the first build; reuse it for updates.

Brand icon update (2026-10-05): supplied `reliantoutreach-favicon.zip` assets replace the app icon, splash mark, mobile web favicon, and the portal/PWA icons. The full-square maskable asset is used for native icons, including Android adaptive icons. Android version code 2 was submitted as build `096020df-d42c-42d7-80fc-3527060f2e52`; verify its status before downloading. The first APK above still contains the previous icon. The website icon changes remain local until portal deployment.

## Local commands

Use Node 24. From this directory:

    npm ci
    npm run typecheck
    npm run lint
    npx expo-doctor
    npm run export
    npm start

This is an independent npm project. Do not install its dependencies in the Next.js app. The browser export is for isolated UI checks; push and secure storage require an installed native build. Production authentication intentionally does not enable cross-origin browser CORS.

From the repository root:

    node scripts/check-mobile-ui.mjs

The UI check uses installed Chrome, intercepts every remote request and supplies synthetic fixtures. It never sends a real reply or creates a real order. Screenshots are saved in the ignored mobile qa-results directory. Set QA_BROWSER to another installed Playwright browser channel if necessary.

## Accounts and first installable builds

1. Create an Expo account. Run the commands below here, and retain the resulting project ID.
2. Copy .env.example to a local .env. Set EXPO_PUBLIC_EAS_PROJECT_ID locally and in EAS build environments. Set EXPO_PUBLIC_API_URL to the HTTPS portal with the new mobile backend. Never put access tokens in an EXPO_PUBLIC variable.
3. Android: create a Firebase Android app for com.reliantoutreach.mobile, configure FCM v1 credentials in EAS, and provide google-services.json as the local path / EAS file variable GOOGLE_SERVICES_JSON.
4. iPhone: configure an Apple Developer account, bundle ID com.reliantoutreach.mobile and APNs credentials in EAS. Register physical test devices for internal distribution, or use TestFlight.
5. Build Android with the preview profile for a directly installable APK. Build iOS with preview for registered devices; use production and EAS Submit for TestFlight.
6. Sign in on the phone, open Account → Enable notifications, and allow the OS permission. Use a native development or release build for remote-push testing, not Expo Go.

Commands:

    npx eas-cli@latest login
    npx eas-cli@latest init
    npx eas-cli@latest build --platform android --profile preview
    npx eas-cli@latest build --platform ios --profile preview

Verify ownership/availability of the proposed app identifiers before first build. EAS generates native projects from app.config.ts; do not maintain Android/iOS folders by hand.

Official references:

- https://docs.expo.dev/build/introduction/
- https://docs.expo.dev/push-notifications/push-notifications-setup/
- https://docs.expo.dev/push-notifications/sending-notifications/

## Backend deployment

Use the repository's normal backup and Hostinger deployment workflow. Apply the additive migration in prisma/migrations/20261005000000_native_mobile using Prisma migrate deploy. It adds native devices, an outbox, read/star state, package requests and a nullable reply-event field. No reset or seed overwrite is needed.

Server settings:

    NEXT_PUBLIC_APP_URL=https://app.reliantoutreach.com
    MOBILE_PUSH_ENABLED=1
    EXPO_ACCESS_TOKEN=<server-only Expo access token>
    CRON_SECRET=<existing strong cron secret>

Preserve database, auth, encryption, SMTP and Manyreach settings. Enable enhanced push security on the Expo project and supply its server access token. Never bundle server credentials in the app.

The existing authenticated worker must run independently of every browser/phone:

    POST /api/internal/cron/process-jobs
    Authorization: Bearer <CRON_SECRET>

Run it at least once per minute through the Hostinger scheduler or an always-running worker. Native delivery and receipt collection are independent worker stages.

Manyreach replies currently use API polling, not a verified webhook. Delay depends on cron frequency, provider latency and the rotating scan queue. This is near-real-time polling, not an instantaneous-delivery promise. Large workspaces can require several passes.

## Notification behavior

- Device enrollment establishes a baseline; refreshing Inbox does not notify old history.
- Deterministic event/device IDs prevent duplicate outbox creation. Foreground IDs are remembered, and OS collapse/tag identifiers identify each event.
- Alerts contain generic text, without email subjects, bodies or contact details. Taps resolve events through authenticated client-scoped endpoints.
- Every send checks session expiry, account state, membership and permission. Session deletion cascades to the device and its queued deliveries. Switching workspace removes the previous registration.
- Sign-out requires network access so the server can revoke the session. Permission/token changes are checked on resume.
- A ticket confirms Expo acceptance; a receipt confirms FCM/APNs acceptance. Neither proves the phone displayed the alert.
- Explicit transient/throttle failures back off. An ambiguous network timeout is recorded as uncertain instead of blindly resending. Review these records before manual retry.
- Force-stop, phone settings, battery restrictions, expired sessions, network/provider outages and OS policies can delay or prevent delivery. Provider delivery is not an exactly-once guarantee.

## Package requests

Owners/admins can submit or cancel. Only one pending/approved request is allowed per workspace. Repeated submission keys return the existing request.

Superadmin → Clients → client detail → Package requests:

1. Review and approve/decline with a client-visible note.
2. Activate an approved email plan after commercial arrangements are confirmed. Approval alone does not change the live package.
3. If pricing changed, decline and request a fresh review.
4. For another separately delivered service, use “Mark other service fulfilled”; this does not replace the email workspace package.

No payment or external subscription is created. Order history covers requests created by this flow, without fabricated historic invoices or progress.

## Verification and release gates

Completed locally: Android/iOS Hermes and web exports; mobile TypeScript/lint; Expo Doctor 21/21; Next.js webpack production build; automated backend/security tests; isolated mobile UI walkthrough at 360/390/430/768 widths with zero live replies.

The auth integration test uses real Better Auth with an isolated memory adapter: signed bearer accepted, raw/forged tokens rejected and logout revocation verified. Other tests cover cross-client access, roles, stable message identity, duplicate orders, push tickets/receipts and retries.

Still required before distribution:

- Deploy/migrate the backend and verify the Hostinger worker.
- Expo/FCM/APNs credentials, signing and APK/iOS distribution.
- Real Android/iPhone cold start, keyboard, scrolling, app-closed delivery, denial/offline/reconnect, token rotation, logout/session expiry, duplicate events and notification taps. Measure performance on a lower-end Android phone.
- Recheck SDK dependency advisories. The current Expo 57 audit reports 30 advisories (19 high, 11 moderate), largely propagated build-tool findings in Metro/Expo, plus router URL decoding. Automatic recommendations include incompatible SDK upgrades/downgrades; these were not forced. Select a supported patched dependency set and repeat exports/device checks before store release.

Known scope boundaries:

- Inbox presents up to 100 loaded conversations and searches that set; use the web portal for older global history. Global newest-first provider ordering is undocumented.
- Thread history automatically fetches advancing pages, bounded to 100 pages.
- Drafts survive navigation in the current app session, not app termination. Logout/workspace switching clears drafts and cached data.
- Statistics reflect timestamped server snapshots; missing values are unavailable rather than fabricated zeros.
- No AI generation, campaign creation or sending-account administration is included in this focused mobile app.
