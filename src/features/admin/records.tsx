"use client";
import {
  DataTable,
  ErrorBox,
  PageTitle,
  Refresh,
  Status,
} from "@/components/data";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { useLive } from "@/features/portal/hooks";
import { api } from "@/lib/browser-api";
import { useState } from "react";

export function AdminRecords({ kind }: { kind: string }) {
  const [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [pending, setPending] = useState<any>(),
    [busy, setBusy] = useState(false);
  const q = useLive(`/api/admin/${kind}?page=${page}`);
  const definitions: Record<string, any[]> = {
    users: [
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      {
        key: "superadmin",
        label: "Superadmin",
        render: (r: any) => (r.superadmin ? "Yes" : "No"),
      },
      {
        key: "disabled",
        label: "Access",
        render: (r: any) => (
          <Status value={r.disabled ? "Disabled" : "Active"} />
        ),
      },
    ],
    invitations: [
      { key: "email", label: "Email" },
      { key: "client", label: "Company", render: (r: any) => r.client.company },
      { key: "role", label: "Role" },
      {
        key: "expiresAt",
        label: "Expires",
        render: (r: any) => new Date(r.expiresAt).toLocaleString(),
      },
      {
        key: "status",
        label: "State",
        render: (r: any) => (
          <Status
            value={
              r.acceptedAt
                ? "Accepted"
                : r.revokedAt
                  ? "Revoked"
                  : new Date(r.expiresAt) < new Date()
                    ? "Expired"
                    : r.sentAt
                      ? "Sent"
                      : "Queued"
            }
          />
        ),
      },
    ],
    jobs: [
      { key: "type", label: "Job" },
      {
        key: "status",
        label: "Status",
        render: (r: any) => <Status value={r.status} />,
      },
      {
        key: "progress",
        label: "Progress",
        render: (r: any) => `${r.progress} / ${r.total}`,
      },
      { key: "attempts", label: "Attempts" },
      { key: "error", label: "Details" },
    ],
    audit: [
      { key: "action", label: "Action" },
      { key: "clientId", label: "Client reference" },
      { key: "actorId", label: "Actor reference" },
      {
        key: "createdAt",
        label: "Time",
        render: (r: any) => new Date(r.createdAt).toLocaleString(),
      },
    ],
  };
  return (
    <>
      <PageTitle
        eyebrow="ADMINISTRATION"
        title={kind[0].toUpperCase() + kind.slice(1)}
      >
        <Refresh onClick={() => q.refetch()} />
      </PageTitle>
      {error && <ErrorBox error={error} />}
      <DataTable
        rows={q.data?.items || []}
        columns={definitions[kind] || []}
        loading={q.isLoading}
        error={q.error}
        page={page}
        onPage={setPage}
        actions={
          kind === "invitations"
            ? (r) =>
                !r.acceptedAt && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try {
                          await api(
                            `/api/admin/invitations/${r.id}/resend`,
                            {},
                          );
                          q.refetch();
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      Resend
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try {
                          await api(
                            `/api/admin/invitations/${r.id}/revoke`,
                            {},
                          );
                          q.refetch();
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      Revoke
                    </Button>
                  </>
                )
            : kind === "users"
              ? (r) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setPending({
                        title: r.disabled ? "Enable user?" : "Disable user?",
                        message: `${r.email} ${r.disabled ? "will regain access" : "will be signed out and lose application access"}.`,
                        url: `/api/admin/users/${r.id}`,
                        data: { disabled: !r.disabled },
                      })
                    }
                  >
                    {r.disabled ? "Enable" : "Disable"}
                  </Button>
                )
              : kind === "jobs"
                ? (r) =>
                    ["pending", "retry"].includes(r.status) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setPending({
                            title: "Cancel queued job?",
                            message:
                              "Unprocessed work will be cancelled. Work already completed is retained.",
                            url: `/api/admin/jobs/${r.id}/cancel`,
                            data: {},
                          })
                        }
                      >
                        Cancel job
                      </Button>
                    )
                : undefined
        }
      />
      <Modal
        open={!!pending}
        onOpenChange={(v) => !v && setPending(undefined)}
        title={pending?.title || "Confirm action"}
      >
        <p>{pending?.message}</p>
        <div className="form-actions">
          <Button variant="outline" onClick={() => setPending(undefined)}>
            Back
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(pending.url, pending.data);
                setPending(undefined);
                q.refetch();
              } catch (e) {
                setError((e as Error).message);
                setPending(undefined);
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirm
          </Button>
        </div>
      </Modal>
    </>
  );
}
