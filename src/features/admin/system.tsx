"use client";
import {
  DataTable,
  ErrorBox,
  Loading,
  PageTitle,
  Refresh,
} from "@/components/data";
import { useLive } from "@/features/portal/hooks";

export function System() {
  const q = useLive("/api/admin/system");
  return (
    <>
      <PageTitle
        eyebrow="OPERATIONS"
        title="System health"
        description="Connection status and background processing."
      >
        <Refresh onClick={() => q.refetch()} />
      </PageTitle>
      {q.error ? (
        <ErrorBox error={q.error} />
      ) : q.isLoading ? (
        <Loading />
      ) : (
        <>
          <div className="health-grid">
            {[
              ["Application", q.data.application],
              ["MySQL", q.data.mysql],
              ["Manyreach API", q.data.provider],
              ["Pending jobs", q.data.pendingJobs],
              ["Failed jobs", q.data.failedJobs],
              ["Last cron run", q.data.cron?.value || "Never"],
            ].map(([label, value]) => (
              <div className="panel health-card" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <p className="notice">
            Webhook: {q.data.webhook}. Polling and reconciliation are active
            when the app and cron are configured.
          </p>
          <h2 className="section-space">Recent API calls</h2>
          <DataTable
            rows={q.data.logs}
            columns={[
              { key: "operation", label: "Operation" },
              { key: "status", label: "HTTP status" },
              { key: "durationMs", label: "Duration (ms)" },
              {
                key: "createdAt",
                label: "When",
                render: (r: any) => new Date(r.createdAt).toLocaleString(),
              },
            ]}
          />
        </>
      )}
    </>
  );
}
