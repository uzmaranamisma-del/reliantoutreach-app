"use client";
import { useState } from "react";
import { DataTable, ErrorBox, PageTitle, Refresh } from "@/components/data";
import { Button } from "@/components/ui/button";
import { useLive } from "./hooks";
import { api } from "@/lib/browser-api";
export function Notifications() {
  const [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const q = useLive(`/api/portal/notifications?page=${page}`, 45);
  return (
    <>
      <PageTitle
        title="Notifications"
        description="Import, synchronization and invitation results for your workspace. Acknowledgments are shared by the team."
      >
        <Refresh onClick={() => q.refetch()} busy={q.isFetching} />
      </PageTitle>
      {error && <ErrorBox error={error} />}
      <DataTable
        rows={q.data?.items || []}
        loading={q.isLoading}
        error={q.error}
        page={page}
        total={q.data?.total}
        onPage={setPage}
        columns={[
          { key: "title", label: "Update" },
          {
            key: "createdAt",
            label: "Received",
            render: (r) => new Date(r.createdAt).toLocaleString(),
          },
          {
            key: "readAt",
            label: "Status",
            render: (r) => (r.readAt ? "Acknowledged" : "New"),
          },
        ]}
        actions={(r) =>
          !r.readAt && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await api(`/api/portal/notifications/${r.id}`, {});
                  await q.refetch();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Acknowledge
            </Button>
          )
        }
      />
    </>
  );
}
