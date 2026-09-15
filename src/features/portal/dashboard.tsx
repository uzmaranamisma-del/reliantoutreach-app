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

export function Dashboard({ preview }: { preview?: ClientPreview } = {}) {
  const context = useContext(!preview);
  const ctx = preview ? { ...preview, poll: { dashboard: 45 } } : context.data;
  const overview = useLive(
    "/api/portal/overview",
    ctx?.poll.dashboard || 45,
    !preview,
  );
  const overviewData = preview || overview.data;
  const campaigns = useQuery({
    queryKey: ["dashboard-campaigns"],
    queryFn: () => api("/api/portal/campaigns?limit=5"),
    enabled: !preview && !!ctx?.permissions["campaigns.view"],
    refetchInterval: Math.max(30, ctx?.poll.dashboard || 45) * 1000,
  });
  const values = overviewData?.snapshot?.values;
  const cards = [
    ["Campaigns", values?.campaigns, Send],
    ["Connected senders", values?.senders, Mail],
    ["Prospects", values?.prospects, Users],
    ["Prospect lists", values?.lists, Layers],
    ["Emails sent", values?.sentCount, Send],
    ["Campaign replies", values?.replyCount, MessageSquare],
    ["Email opens", values?.openCount, Mail],
    ["Bounces", values?.bounceCount, Mail],
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
      <div className="overview-banner">
        <div>
          <span className="eyebrow">YOUR OUTREACH WORKSPACE</span>
          <h2>Keep the conversation moving.</h2>
          <p>Manage your campaigns and follow up on the replies that matter.</p>
        </div>
        <div className="banner-symbol">
          <ArrowUpRight size={42} />
        </div>
      </div>
      {!preview && overview.error && <ErrorBox error={overview.error} />}
      <div className="metric-grid">
        {cards.map(([label, value, Icon]) => (
          <div className="metric-card" key={label}>
            <div>
              <span>{label}</span>
              <Icon size={19} />
            </div>
            <strong>
              {value === undefined ? "—" : Number(value).toLocaleString()}
            </strong>
            <small>
              {value === undefined
                ? "Awaiting first usage sync"
                : "Latest sync · all-time totals"}
            </small>
          </div>
        ))}
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
    </>
  );
}
