"use client";
import { useState } from "react";
import {
  DataTable,
  Empty,
  ErrorBox,
  Loading,
  PageTitle,
  Status,
} from "@/components/data";
import type { ClientPreview } from "@/lib/client-preview";
import { useLive } from "./hooks";

const titles: Record<string, [string, string]> = {
  campaigns: [
    "Campaigns",
    "All campaigns in this client's Manyreach clientspace.",
  ],
  inbox: ["Inbox", "Incoming Manyreach replies for this client."],
  prospects: ["Prospects", "Contacts synchronized from Manyreach."],
  lists: ["Lists", "Prospect lists in this clientspace."],
  senders: ["Senders", "Connected sending accounts and their status."],
  analytics: ["Analytics", "Latest synchronized outreach totals."],
  team: ["Team", "Workspace members and invitations."],
  usage: [
    "Package & usage",
    "Assigned package, services, limits and current usage.",
  ],
  notifications: ["Notifications", "Workspace job and delivery updates."],
  settings: ["Workspace settings", "Saved client and connection information."],
};

const resourceColumns: Record<string, any[]> = {
  campaigns: [
    { key: "name", label: "Campaign" },
    {
      key: "status",
      label: "Status",
      render: (r: any) => <Status value={r.status} />,
    },
    { key: "sentCount", label: "Sent" },
    { key: "replyCount", label: "Replies" },
    { key: "openCount", label: "Opens" },
    { key: "bounceCount", label: "Bounces" },
  ],
  prospects: [
    { key: "email", label: "Email" },
    { key: "firstName", label: "First name" },
    { key: "lastName", label: "Last name" },
    { key: "company", label: "Company" },
    {
      key: "sendingStatus",
      label: "Status",
      render: (r: any) => <Status value={r.sendingStatus} />,
    },
  ],
  lists: [
    { key: "title", label: "List" },
    {
      key: "createdAt",
      label: "Created",
      render: (r: any) =>
        r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—",
    },
  ],
  senders: [
    { key: "email", label: "Email account" },
    { key: "fromName", label: "Sender name" },
    { key: "dailyLimit", label: "Daily limit" },
    {
      key: "warmup",
      label: "Warmup",
      render: (r: any) => (r.warmup ? "Enabled" : "Disabled"),
    },
    {
      key: "disconnected",
      label: "Connection",
      render: (r: any) => (
        <Status value={r.disconnected ? "Error" : "Connected"} />
      ),
    },
  ],
  inbox: [
    { key: "fromEmail", label: "From" },
    { key: "subject", label: "Subject" },
    { key: "preview", label: "Message" },
    {
      key: "createdAt",
      label: "Received",
      render: (r: any) =>
        r.createdAt ? new Date(r.createdAt).toLocaleString() : "—",
    },
  ],
};

export function PreviewPortal({
  preview,
  section,
}: {
  preview: ClientPreview;
  section: string;
}) {
  const selected = titles[section] ? section : "campaigns";
  const [page, setPage] = useState(1),
    [cursors, setCursors] = useState<string[]>([""]);
  const cursor = cursors[page - 1];
  const q = useLive(
    `/api/admin/clients/${preview.id}/preview/${selected}?page=${cursor ? 1 : page}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
  );
  const [title, description] = titles[selected];
  if (
    ["campaigns", "inbox", "prospects", "lists", "senders"].includes(selected)
  )
    return (
      <>
        <PageTitle
          eyebrow="CLIENT PREVIEW"
          title={title}
          description={description}
        />
        {q.error ? (
          <ErrorBox error={q.error} retry={() => q.refetch()} />
        ) : q.isLoading ? (
          <Loading />
        ) : !q.data.connected ? (
          <div className="panel">
            <Empty
              title={`${title} will appear after connection`}
              description="Return to client setup, enter the isolated Manyreach clientspace API key, then complete Sync & Invite."
            />
          </div>
        ) : (
          <DataTable
            rows={q.data.items || []}
            columns={resourceColumns[selected]}
            page={page}
            total={q.data.pagination?.totalItems}
            loading={q.isLoading}
            error={q.error}
            onPage={(next) => {
              if (next > page && q.data.pagination?.nextCursor)
                setCursors([
                  ...cursors.slice(0, page),
                  q.data.pagination.nextCursor,
                ]);
              setPage(next);
            }}
          />
        )}
      </>
    );
  return (
    <>
      <PageTitle
        eyebrow="CLIENT PREVIEW"
        title={title}
        description={description}
      />
      {q.error ? (
        <ErrorBox error={q.error} retry={() => q.refetch()} />
      ) : q.isLoading ? (
        <Loading />
      ) : selected === "analytics" ? (
        <PreviewAnalytics data={q.data} />
      ) : selected === "usage" ? (
        <PreviewUsage data={q.data} />
      ) : selected === "team" ? (
        <PreviewTeam data={q.data} />
      ) : selected === "notifications" ? (
        <PreviewNotifications data={q.data} />
      ) : (
        <PreviewSettings data={q.data} />
      )}
    </>
  );
}

function PreviewAnalytics({ data }: { data: any }) {
  const values = data.snapshot?.values || {};
  return (
    <>
      <div className="metric-grid">
        {[
          ["Sent", "sentCount"],
          ["Replies", "replyCount"],
          ["Opens", "openCount"],
          ["Clicks", "clickCount"],
          ["Bounces", "bounceCount"],
          ["Interested", "interestedCount"],
        ].map(([label, key]) => (
          <div className="metric-card" key={key}>
            <span>{label}</span>
            <strong>
              {values[key] === undefined
                ? "—"
                : Number(values[key]).toLocaleString()}
            </strong>
            <small>Latest all-campaign sync</small>
          </div>
        ))}
      </div>
      {!data.snapshot && (
        <div className="panel section-space">
          <Empty title="Analytics will appear after the first sync" />
        </div>
      )}
    </>
  );
}
function PreviewUsage({ data }: { data: any }) {
  return (
    <>
      <div className="plan-banner">
        <div>
          <span className="eyebrow">CURRENT PACKAGE</span>
          <h2>{data.package}</h2>
          <p>
            {data.plan.currency} {Number(data.plan.price).toLocaleString()}{" "}
            {data.billingLabel} · {data.plan.currency}{" "}
            {Number(data.plan.setupPrice).toLocaleString()} setup
          </p>
          <p>{data.plan.description}</p>
        </div>
        <Status value="Assigned" />
      </div>
      <div className="dashboard-grid section-space">
        {[
          ["Setup includes", data.plan.setupIncludes],
          ["Monthly services", data.plan.monthlyIncludes],
        ].map(([label, items]) => (
          <section className="panel content-panel" key={label as string}>
            <h2>{label as string}</h2>
            <ul>
              {(Array.isArray(items) ? items : []).map((item: string) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="usage-grid">
        {Object.entries(data.limits || {}).map(([key, value]) => (
          <div className="panel usage-card" key={key}>
            <h3>{key.replace(/([A-Z])/g, " $1")}</h3>
            <p>
              <strong>
                {data.snapshot?.values?.[key] === undefined
                  ? "—"
                  : Number(data.snapshot.values[key]).toLocaleString()}
              </strong>{" "}
              / {value === -1 ? "Unlimited" : String(value)}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
function PreviewTeam({ data }: { data: any }) {
  return (
    <>
      <h2>Members</h2>
      <DataTable
        rows={data.items || []}
        columns={[
          { key: "name", label: "Name", render: (r: any) => r.user.name },
          { key: "email", label: "Email", render: (r: any) => r.user.email },
          {
            key: "role",
            label: "Role",
            render: (r: any) => (
              <Status value={r.role.replace("CLIENT_", "")} />
            ),
          },
        ]}
      />
      <h2 className="section-space">Invitations</h2>
      <DataTable
        rows={data.invitations || []}
        columns={[
          { key: "email", label: "Email" },
          { key: "role", label: "Role" },
          {
            key: "status",
            label: "Status",
            render: (r: any) => (
              <Status
                value={
                  r.acceptedAt
                    ? "Accepted"
                    : r.revokedAt
                      ? "Revoked"
                      : r.sentAt
                        ? "Sent"
                        : "Queued"
                }
              />
            ),
          },
          {
            key: "expiresAt",
            label: "Expires",
            render: (r: any) => new Date(r.expiresAt).toLocaleString(),
          },
        ]}
      />
    </>
  );
}
function PreviewNotifications({ data }: { data: any }) {
  return (
    <DataTable
      rows={data.items || []}
      columns={[
        { key: "title", label: "Notification" },
        {
          key: "createdAt",
          label: "Created",
          render: (r: any) => new Date(r.createdAt).toLocaleString(),
        },
        {
          key: "readAt",
          label: "Status",
          render: (r: any) => <Status value={r.readAt ? "Read" : "Unread"} />,
        },
      ]}
    />
  );
}
function PreviewSettings({ data }: { data: any }) {
  return (
    <div className="panel content-panel">
      <dl className="resource-details">
        {Object.entries(data || {}).map(([key, value]) => (
          <div key={key}>
            <dt>{key.replace(/([A-Z])/g, " $1")}</dt>
            <dd>
              {value == null || value === ""
                ? "—"
                : typeof value === "boolean"
                  ? value
                    ? "Yes"
                    : "No"
                  : key.endsWith("At")
                    ? new Date(String(value)).toLocaleString()
                    : String(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
