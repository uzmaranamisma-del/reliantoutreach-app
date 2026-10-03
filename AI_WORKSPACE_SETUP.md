# AI Workspace — setup UI release

This release prepares the interface and saves workspace-specific business knowledge. It does not connect an AI provider, generate text, classify replies, change notifications, or send outreach.

## Available now

- Client navigation: **AI Workspace** → Business knowledge, Reply style, Smart inbox, Priority alerts.
- Owners and client admins can save approved business information, FAQs, an HTTPS booking link, writing preferences, and future priority categories.
- Members can read setup. Superadmin client preview is read-only; open the client workspace to edit.
- Inbox: **AI reply assistant** opens draft/shorten/tone/translation controls. Generate draft is disabled with an explicit connection notice. Existing manual drafts and sending are preserved.
- Priority-alert preferences are saved for future integration and do not change current push delivery.
- Settings displays the AI connection status. This release always reports `not_connected`.

## Persistence and access

Migration `20261003020000_ai_workspace` adds one cascading `AiWorkspace` record per client. Reads and writes use the authenticated tenant, not a submitted client ID. Writes require owner/admin role, same-origin requests, schema validation and a matching revision. Concurrent edits return a conflict instead of overwriting a newer setup. Audit entries contain no business knowledge text.

No provider key is needed for this UI release. Business knowledge remains in the portal database and is not transmitted to an AI service. Do not put credentials into business knowledge.

## Future activation

Provider selection and credentials, explicit workspace activation, generation/classification APIs, request budgets and usage tracking, evaluated prompts and output validation, and priority-notification processing still need implementation before these AI capabilities can run. Merely adding an API key will not activate them.

When activating later, preserve manual review before sending, workspace permissions, tenant isolation and the current notification deduplication behavior.
