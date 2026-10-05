# ReliantOutreach mobile

Native Expo / React Native app for Android and iPhone, connected to the existing backend. Three primary tabs: Inbox, Stats and Plans. Account settings contain appearance and notification controls.

## Delivered in source

- Branded login, secure signed session storage and client workspace selection.
- Superadmins can use their own active main Manyreach account in the same client interface. Verified client owners can also open their own active main account when its contact email matches their login. The connection must be `organization`; superadmins can select active main accounts. Selecting it creates an ordinary owner membership, subject to team capacity; existing disabled memberships remain blocked. No admin dashboard is added to the mobile app. This requires deploying the mobile backend, but no new APK for this access change.
- Virtualized inbox, latest loaded reply previews, unread/starred filters and scoped search.
- Chat-style conversation, automatically paginated history, stable message keys and keyboard-aware composer.
- Manual replies through the existing Manyreach integration, with confirmation and duplicate-submission protection. Uncertain responses keep the draft and ask the user to check the conversation.
- Actual package catalog, active-plan badge, upgrade requests, cancellation and order status history. Administrators review requests on the existing client detail page.
- Real statistics, with separate monthly allowance and all-time snapshot labels.
- Native visible push through Expo → FCM/APNs, a durable server queue, token rotation, receipts, backoff and stable collapse identifiers.
- Dark/light themes, bundled brand fonts, safe areas, request cancellation and in-memory query caching.

The Expo project is `@reliantoutreach-team/reliantoutreach-team` (ID `feb20780-3420-405b-bc6e-69f7b6e608d9`). Android build 2 is published at https://app.reliantoutreach.com/download and the mobile backend is deployed. Build 2 does **not** include Firebase configuration. On October 6, Firebase project `reliantoutreach` was connected to the existing Android package, a dedicated FCM API Admin service account was uploaded to EAS, and `GOOGLE_SERVICES_JSON` was configured as a preview secret file. `MOBILE_PUSH_ENABLED=1` was deployed on Hostinger. Version 1.0.1 build 3 (`c66b5ea2-4790-4295-8ffc-4df2ce526b3f`) is queued on EAS with the existing signing key. Do not advance the published release until that APK finishes and is checked. Physical Android registration and closed-app delivery still need verification. Apple credentials and an iOS build remain pending.

The next source version is 1.0.1. It requests notification permission on the first signed-in launch, reconnects allowed devices on resume/token changes, and reminds users at most weekly when notifications are off. An explicit in-app disable remains off until the user enables it again. Registration failures appear in Account rather than claiming success. Android update checks use the installed native build number, never a bundled JS version. Checks run on foreground entry at most every six hours, with a manual Account check. Dismissed update notices wait seven days; a different new build can notify immediately. Downloads open the trusted portal and require the user's install confirmation.

For APK builds on Windows run `powershell.exe -ExecutionPolicy Bypass -File .\build-android.ps1` here. The script limits uploads to this mobile project and excludes local credentials. Use an EAS secret file variable `GOOGLE_SERVICES_JSON` in the preview environment and upload the corresponding FCM v1 service account through EAS credentials. Reuse the existing Android signing key for updates. Never publish a build as notification-ready without checking Firebase token registration and a receipt on a physical device.

To publish an update, first finish and verify its signed EAS APK. Then update `src/lib/mobile-release.ts` in the portal with the actual version, build, notes and verified artifact URL. This single record drives both `/download` and `/api/mobile-release`. Never advance it to an unbuilt version. Existing build 2 does not contain the new update checker; users must install the next APK once manually.

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
6. Sign in on the new APK and allow the first-launch OS permission. Account → Enable notifications is also available. Use a native development or release build for remote-push testing, not Expo Go.

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
