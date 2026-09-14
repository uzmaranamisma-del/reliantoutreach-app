# Published package catalog

Source: [ReliantOutreach pricing](https://reliantoutreach.com/#pricing), checked September 14, 2026. Amounts are USD.

| Package | One-time setup | Monthly management | Published capacity |
|---|---:|---:|---|
| Launch | $1,500 | $500 | 5,000 emails/month |
| Growth | $2,500 | $1,000 | 25,000 emails/month |
| Scale | $4,000 | $1,500 | 50,000 emails/month |
| LinkedIn Outreach | $1,500 | $2,500 | 300 initial messages, then 1,500/month |

All packages have a three-month management minimum. Setup is paid upfront. The dashboard includes each package's setup services, monthly services and commercial terms. LinkedIn is a managed service catalog entry, not a LinkedIn automation integration.

The owner chose to supply the unpublished numeric limits. Launch, Growth and Scale stay in draft until those limits are reviewed. They can be selected in Create client workspace to save an inactive client draft. Draft creation does not create a provider clientspace or queue an invitation. Add the verified connection on the client details page, review/activate its email package, then activate the workspace and send its owner invitation. No technical resource allowances have been invented. Missing limits deny capacity. Provide the following for each email plan:

- Connected sending inboxes
- Campaigns
- Total stored prospects
- Lists
- Team members (including owner)
- Rows per CSV upload

Use an explicit `-1` only for a genuinely unlimited allowance. The known monthly email capacities are already populated. A finite monthly cap currently blocks sending because authoritative provider enforcement is unresolved; reviewing a package does not remove that release gate.

The repeat-safe import is `npx tsx scripts/import-published-packages.ts` after migrations and Superadmin creation. It skips existing package names and does not overwrite subsequent owner edits. Local import is complete. Publishing or deploying remains on hold at the owner's request.
