"use client";
import {
  DataTable,
  Empty,
  ErrorBox,
  PageTitle,
  Refresh,
} from "@/components/data";
import { Button } from "@/components/ui/button";
import { useLive } from "@/features/portal/hooks";
import { Building2, Mail, Plus, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";

export function Overview() {
  const q = useLive("/api/admin/overview", 45);
  return (
    <>
      <PageTitle
        eyebrow="SUPERADMIN"
        title="Platform overview"
        description="Your clients, workspaces, and platform activity."
      >
        <Refresh onClick={() => q.refetch()} />
        <Button asChild>
          <Link href="/admin/clients">
            <Plus size={16} />
            Create client
          </Link>
        </Button>
      </PageTitle>
      {q.error && <ErrorBox error={q.error} />}
      <div className="metric-grid">
        {[
          ["Total clients", "clients", Building2],
          ["Active clients", "active", Users],
          ["Suspended", "suspended", ShieldCheck],
          ["Pending invitations", "pending", Mail],
        ].map(([label, key, Icon]: any) => (
          <div className="metric-card" key={key}>
            <div>
              <span>{label}</span>
              <Icon size={19} />
            </div>
            <strong>{q.data?.[key] ?? "—"}</strong>
            <small>Platform records</small>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section>
          <div className="section-title">
            <h2>Recent activity</h2>
            <Link href="/admin/audit" className="text-link">
              View audit log
            </Link>
          </div>
          <DataTable
            rows={q.data?.activity || []}
            columns={[
              { key: "action", label: "Action" },
              {
                key: "createdAt",
                label: "When",
                render: (r: any) => new Date(r.createdAt).toLocaleString(),
              },
            ]}
          />
        </section>
        <section>
          <div className="section-title">
            <h2>Package distribution</h2>
          </div>
          <div className="panel content-panel">
            {q.data?.packages?.length ? (
              q.data.packages.map((p: any) => (
                <div className="distribution-row" key={p.id}>
                  <span>{p.name}</span>
                  <strong>{p._count.clients} clients</strong>
                </div>
              ))
            ) : (
              <Empty
                title="Create your first package"
                description="Packages control client features and limits."
              />
            )}
          </div>
        </section>
      </div>
    </>
  );
}
