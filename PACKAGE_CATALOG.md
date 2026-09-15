# Published package catalog

Source: [ReliantOutreach pricing](https://reliantoutreach.com/#pricing), checked September 15, 2026. Amounts are USD.

| Package | One-time setup | Monthly management | Published capacity |
|---|---:|---:|---|
| Launch | $558 | $500 | 5,000 emails/month |
| Growth | $930 | $1,000 | 25,000 emails/month |
| Scale | $1,488 | $1,500 | 50,000 emails/month |
| LinkedIn Outreach | $558 | $2,500 | 300 initial messages, then 1,500/month |

All packages have a three-month management minimum. Setup is paid upfront. The dashboard includes each package's setup services, monthly services and commercial terms. LinkedIn is a managed service catalog entry, not a LinkedIn automation integration.

On September 15, 2026, the owner approved unlimited technical limits for Launch, Growth and Scale. All three email plans are active with explicit `-1` limits for connected senders, campaigns, prospects, lists, team members and CSV rows. Published monthly email capacities remain 5,000 / 25,000 / 50,000. LinkedIn remains an inactive service catalog entry.

Existing local plans were updated with `npx tsx scripts/apply-approved-package-limits.ts`. This script targets only those three named email plans and preserves monthly email capacities. New website imports apply the same approved policy.

Client onboarding is Client details → Package → Permissions → Sync & Invite. The clientspace key is verified, campaigns/prospects/lists/senders/replies are checked, and the client activates with an owner invitation queued only after successful checks. Draft saving remains available, and the permissions step supports selecting all permissions at once.

Finite monthly caps still block new campaign starts/manual replies because authoritative provider enforcement is unresolved. Read access to existing provider data is available after activation; technical unlimited allowances do not remove the monthly sending release gate.

Superadmins can use **Sync website packages** to import or refresh these four catalog entries from the published source. It preserves unrelated custom packages and makes Launch, Growth and Scale active while keeping LinkedIn Outreach as an inactive catalog entry.
