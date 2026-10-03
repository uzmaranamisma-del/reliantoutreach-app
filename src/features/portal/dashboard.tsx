"use client";
import {
  DataTable,
  Empty,
  ErrorBox,
  Loading,
  PageTitle,
  Refresh,
  Status,
} from "@/components/data";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/browser-api";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Check,
  ShieldCheck,
  ChartNoAxesCombined as ChartIcon,
  Layers,
  Mail,
  MessageSquare,
  Plus,
  Send,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useContext, useLive } from "./hooks";
import type { ClientPreview } from "@/lib/client-preview";
import { PackageCatalog } from "./workspace";

export function Dashboard({ preview }: { preview?: ClientPreview } = {}) {
  const context = useContext(!preview);
  const ctx = preview ? { ...preview, poll: { dashboard: 45 } } : context.data;
  const overview = useLive(
    "/api/portal/overview",
    ctx?.poll.dashboard || 45,
    !preview,
  );
  const overviewData = preview || overview.data;
  const packages = useLive("/api/portal/packages", 300, !preview);
  const campaigns = useQuery({
    queryKey: ["dashboard-campaigns"],
    queryFn: () => api("/api/portal/campaigns?limit=5"),
    enabled: !preview && !!ctx?.permissions["campaigns.view"],
    refetchInterval: Math.max(30, ctx?.poll.dashboard || 45) * 1000,
  });
  const values = overviewData?.snapshot?.values;
  const cards = [
    ["Emails sent", values?.sentCount, Send, "usage", "View sending activity"],
    [
      "Campaign replies",
      values?.replyCount,
      MessageSquare,
      "inbox",
      "Open inbox",
    ],
    ["Prospects", values?.prospects, Users, "prospects", "Manage prospects"],
    ["Senders", values?.senders, Mail, "senders", "Review senders"],
  ] as const;
  return (
    <>
      <PageTitle
        eyebrow="WORKSPACE OVERVIEW"
        title={`Welcome back${ctx?.name ? `, ${ctx.name.split(" ")[0]}` : ""}`}
        description="A clear view of your outreach, all in one place."
      >
        {!preview && (
          <Refresh
            onClick={() => {
              overview.refetch();
              campaigns.refetch();
            }}
            busy={overview.isFetching}
          />
        )}
        {!preview && ctx?.permissions["campaigns.create"] && (
          <Button asChild>
            <Link href="/app/campaigns">
              <Plus size={17} />
              Create campaign
            </Link>
          </Button>
        )}
      </PageTitle>
      {!preview && overview.error && <ErrorBox error={overview.error} />}
      <div className="ro-grid-4 dashboard-kpis">
        {cards.map(([label, value, Icon, slug, footer], index) => (
          <section
            className={`ro-kpi ${index === 0 ? "ro-kpi--featured" : ""}`}
            key={label}
          >
            <div className="ro-kpi__top">
              <span className="ro-tile">
                <Icon />
              </span>
              <div>
                <div className="ro-kpi__title">{label}</div>
                <div className="ro-kpi__sub">
                  {index < 2 ? "All-time campaign totals" : "Your workspace"}
                </div>
              </div>
            </div>
            <div className="ro-kpi__value">
              {value === undefined
                ? "Not synced"
                : Number(value).toLocaleString()}
            </div>
            {!preview &&
            (slug === "usage" || ctx?.permissions[`${slug}.view`]) ? (
              <Link className="ro-kpi__foot" href={`/app/${slug}`}>
                {footer}
                <ArrowUpRight />
              </Link>
            ) : (
              <div className="ro-kpi__foot">Latest workspace sync</div>
            )}
          </section>
        ))}
      </div>
      <div className="ro-dashboard-main">
        <section className="ro-card">
          <div className="ro-card__head">
            <div>
              <h2 className="ro-card__title">Workspace</h2>
              <p className="ro-card__sub">
                {ctx?.package || "Your plan"} ·{" "}
                {ctx?.company || "Your workspace"}
              </p>
            </div>
            {!preview && ctx?.permissions["lists.manage"] && (
              <Button asChild size="sm">
                <Link href="/app/lists">
                  <Plus />
                  New list
                </Link>
              </Button>
            )}
          </div>
          <div className="ro-card__body">
            <div className="ro-minis">
              {(
                [
                  ["Campaigns", values?.campaigns, Send, "Connected campaigns"],
                  [
                    "Prospect lists",
                    values?.lists,
                    Layers,
                    "Organized audiences",
                  ],
                  [
                    "Bounce rate",
                    values?.sentCount
                      ? `${((100 * (Number(values.bounceCount) || 0)) / values.sentCount).toFixed(1)}%`
                      : "Not available",
                    ShieldCheck,
                    "All-time campaign totals",
                  ],
                  [
                    "Replies",
                    values?.replyCount,
                    MessageSquare,
                    "Conversations started",
                  ],
                ] as const
              ).map(([label, value, Icon, detail]) => (
                <div className="ro-mini" key={label}>
                  <div className="ro-mini__head">
                    <Icon />
                    {label}
                  </div>
                  <div className="ro-mini__value">
                    {typeof value === "number"
                      ? value.toLocaleString()
                      : (value ?? "Not synced")}
                  </div>
                  <div className="ro-mini__meta">{detail}</div>
                </div>
              ))}
            </div>
            <div className="ro-funnel dashboard-funnel">
              {[
                ["Sent", "sentCount"],
                ["Opened", "openCount"],
                ["Replied", "replyCount"],
                ["Bounced", "bounceCount"],
              ].map(([label, key]) => (
                <div className="funnel-row" key={key}>
                  <span className="lbl">{label}</span>
                  <div className={`ro-progress funnel-${key}`}>
                    <span
                      style={{
                        width: `${Math.min(100, (100 * (Number(values?.[key]) || 0)) / Math.max(1, Number(values?.sentCount) || 0))}%`,
                      }}
                    />
                  </div>
                  <span className="val">
                    {values?.[key] === undefined
                      ? "N/A"
                      : Number(values[key]).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="ro-card sending-chart">
          <div className="ro-card__head">
            <div>
              <h2 className="ro-card__title">Sending activity</h2>
              <p className="ro-card__sub">Latest sync · all-time events</p>
            </div>
            <ChartIcon size={20} />
          </div>
          <div className="ro-card__body">
            <div className="activity-bars" aria-label="Sending activity totals">
              {[
                ["Sent", "sentCount"],
                ["Opened", "openCount"],
                ["Replied", "replyCount"],
                ["Bounced", "bounceCount"],
              ].map(([label, key], index) => {
                const value = Number(values?.[key]) || 0;
                const max = Math.max(
                  1,
                  ...[
                    "sentCount",
                    "openCount",
                    "replyCount",
                    "bounceCount",
                  ].map((k) => Number(values?.[k]) || 0),
                );
                return (
                  <div className="activity-bar-column" key={key}>
                    <div className="activity-bar-track">
                      <div
                        className={`activity-bar ${index === 0 ? "featured" : ""}`}
                        style={{
                          height: `${values?.[key] === undefined ? 0 : Math.max(value > 0 ? 2 : 0, (100 * value) / max)}%`,
                        }}
                        title={`${label}: ${value.toLocaleString()}`}
                      />
                      <strong>
                        {values?.[key] === undefined
                          ? "N/A"
                          : value.toLocaleString()}
                      </strong>
                    </div>
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>
            <p className="ro-card__sub chart-note">
              {overviewData?.snapshot
                ? `Captured ${new Date(overviewData.snapshot.capturedAt).toLocaleString()}`
                : "Activity appears after the first successful sync."}
            </p>
          </div>
        </section>
      </div>
      <div className="dashboard-grid">
        <section>
          <div className="section-title">
            <h2>Campaigns at a glance</h2>
            {!preview && ctx?.permissions["campaigns.view"] && (
              <Link href="/app/campaigns" className="text-link">
                View campaigns <ArrowUpRight size={15} />
              </Link>
            )}
          </div>
          {preview ? (
            <div className="panel">
              <Empty
                title="Campaigns appear here"
                description="Live campaigns load after workspace activation and connection. This preview shows the dashboard layout and saved workspace information."
              />
            </div>
          ) : ctx?.permissions["campaigns.view"] ? (
            <DataTable
              loading={campaigns.isLoading}
              error={campaigns.error}
              rows={campaigns.data?.items || []}
              columns={[
                {
                  key: "name",
                  label: "Campaign",
                  render: (r: any) => (
                    <Link
                      className="strong-link"
                      href={`/app/campaigns/${r.id}`}
                    >
                      {r.name}
                    </Link>
                  ),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (r: any) => <Status value={r.status} />,
                },
                { key: "sentCount", label: "Sent" },
                { key: "replyCount", label: "Replies" },
              ]}
            />
          ) : (
            <div className="panel">
              <Empty
                title="Campaign access is restricted"
                description="Contact your administrator to update your permissions."
              />
            </div>
          )}
          <div className="snapshot-note">
            {overviewData?.snapshot
              ? `Usage captured ${new Date(overviewData.snapshot.capturedAt).toLocaleString()}`
              : "Usage totals appear after the first scheduled sync."}
          </div>
        </section>
        <section>
          <div className="section-title">
            <h2>Recent activity</h2>
            <span className="small muted">Workspace</span>
          </div>
          <div className="panel activity-panel">
            {!preview && overview.isLoading ? (
              <Loading />
            ) : overviewData?.activity?.length ? (
              overviewData.activity.map((a: any) => (
                <div className="activity-item" key={a.id}>
                  <span className="activity-icon">
                    <Check size={14} />
                  </span>
                  <div>
                    <p>{a.action.replaceAll(".", " ").replaceAll("-", " ")}</p>
                    <small>{new Date(a.createdAt).toLocaleString()}</small>
                  </div>
                </div>
              ))
            ) : (
              <Empty
                title="A fresh start"
                description="Your workspace activity will appear here."
              />
            )}
          </div>
        </section>
      </div>
      {!preview && (
        <section className="quick-links">
          <Link href="/app/usage">
            <Layers />
            <div>
              <h3>Your package & usage</h3>
              <p>Understand your workspace limits.</p>
            </div>
            <ArrowUpRight />
          </Link>
          {ctx?.permissions["inbox.view"] && (
            <Link href="/app/inbox">
              <MessageSquare />
              <div>
                <h3>Continue a conversation</h3>
                <p>Read and respond to incoming replies.</p>
              </div>
              <ArrowUpRight />
            </Link>
          )}
        </section>
      )}
      {!preview && (
        <PackageCatalog
          data={packages.data}
          error={packages.error}
          loading={packages.isLoading}
        />
      )}
    </>
  );
}
