"use client";
import {
  DataTable,
  ErrorBox,
  Loading,
  PageTitle,
  Refresh,
  Status,
} from "@/components/data";
import { displayDate, readable } from "@/lib/presentation";
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
          <div className="service-grid">
            {[
              ["Application", q.data.application],
              ["MySQL", q.data.mysql],
              ["Manyreach API", q.data.provider],
            ].map(([label, value]) => (
              <section key={label} className="ro-card service-card">
                <span className="ro-card__sub">{label}</span>
                <Status value={value} />
              </section>
            ))}
          </div>
          <div className="health-grid health-metrics">
            {[
              ["Pending jobs", q.data.pendingJobs],
              ["Failed jobs", q.data.failedJobs],
              ["Last cron run", q.data.cron?.value || "Never"],
              ["Pending push alerts", q.data.pendingPush],
              ["Expired push alerts", q.data.expiredPush],
              ["Reply scan errors", q.data.replyScanErrors],
              ["Oldest queued alert", q.data.oldestPush?.createdAt || "None"],
            ].map(([label, value]) => (
              <div className="panel health-card" key={label}>
                <span>{label}</span>
                <strong>{readable(value)}</strong>
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
              {
                key: "status",
                label: "HTTP status",
                render: (r: any) => <Status value={r.status} />,
              },
              { key: "durationMs", label: "Duration (ms)" },
              {
                key: "createdAt",
                label: "When",
                render: (r: any) => displayDate(r.createdAt),
              },
            ]}
          />
        </>
      )}
    </>
  );
}
