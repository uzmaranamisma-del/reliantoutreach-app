"use client";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorBox, Status } from "@/components/data";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/browser-api";
import { useLive } from "@/features/portal/hooks";
export function ClientSync({
  clientId,
  connected,
}: {
  clientId: string;
  connected: boolean;
}) {
  const q = useLive(`/api/admin/clients/${clientId}/sync`, 5),
    cache = useQueryClient();
  const [apiKey, setApiKey] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [key, setKey] = useState(() => crypto.randomUUID());
  const state = q.data;
  const inFlight = useRef(false);
  const { refetch, dataUpdatedAt } = q;
  const working =
    !!state?.job &&
    (["pending", "retry", "processing"].includes(state.job.status) ||
      (state.job.syncCompleted &&
        state.email &&
        ["pending", "retry", "processing"].includes(state.email.status)));
  useEffect(() => {
    if (!working || !state?.job?.id) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        await api(`/api/admin/clients/${clientId}/sync-progress`, {
          jobId: state.job.id,
        });
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        inFlight.current = false;
        await refetch();
        await cache.invalidateQueries({
          queryKey: [`/api/admin/clients/${clientId}`],
        });
      }
    }, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    working,
    state?.job?.id,
    state?.job?.progress,
    state?.job?.status,
    state?.email?.status,
    dataUpdatedAt,
    refetch,
    clientId,
    cache,
  ]);
  return (
    <section className="panel content-panel">
      <h2>Manyreach connection & invitation</h2>
      <p>
        Connect this clientspace, sync its data, then send the owner invitation.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api(`/api/admin/clients/${clientId}/sync`, {
              key,
              ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
            });
            setApiKey("");
            setKey(crypto.randomUUID());
            await q.refetch();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Manyreach clientspace API key
          <input
            type="password"
            autoComplete="off"
            name="manyreachApiKey"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              connected
                ? "Saved securely — leave blank to reuse"
                : "Paste this client's API key"
            }
            required={!connected}
            disabled={working || busy}
          />
        </label>
        <p className="muted small">
          You may use this client&apos;s isolated key. An agency key is also accepted
          when Manyreach has exactly one Subaccount with the same name as this
          client.
        </p>
        {state && !state.smtpConfigured && (
          <p className="notice">
            SMTP is not configured yet. Add the SMTP settings to the application
            environment and restart it before sending invitations.
          </p>
        )}
        {(error || q.error) && <ErrorBox error={error || q.error} />}
        <div className="form-actions">
          <Button disabled={busy || working}>
            {busy
              ? "Verifying key…"
              : working
                ? "Sync & invitation in progress…"
                : "Sync & Invite"}
          </Button>
        </div>
      </form>
      {state?.job && (
        <div className="section-space" aria-live="polite">
          <p>
            <Status value={state.job.status} />{" "}
            {state.job.syncCompleted
              ? "Workspace data synchronized"
              : state.job.stage}
          </p>
          <div className="progress-track">
            <div
              style={{
                width: `${Math.min(100, (state.job.progress / Math.max(1, state.job.total)) * 100)}%`,
              }}
            />
          </div>
          {state.job.error && <ErrorBox error={state.job.error} />}
          {state.email?.error && (
            <ErrorBox error={`Invitation: ${state.email.error}`} />
          )}
          {state.invitation?.revokedAt ? (
            <p>
              Invitation revoked. Use Resend owner invitation to issue a new
              link.
            </p>
          ) : state.invitation?.acceptedAt ? (
            <p>The owner accepted the invitation and has workspace access.</p>
          ) : state.invitation?.sentAt ? (
            <p>
              Invitation sent{" "}
              {new Date(state.invitation.sentAt).toLocaleString()}.
            </p>
          ) : state.email ? (
            <p>
              Owner invitation:{" "}
              {state.email.status === "completed"
                ? "Delivery finished; check the invitation record."
                : state.email.status}
              .
            </p>
          ) : state.job.ownerAlreadyHasAccess ? (
            <p>
              The owner already has workspace access. No duplicate invitation
              was sent.
            </p>
          ) : (
            <p>The invitation will be queued after every sync step succeeds.</p>
          )}
        </div>
      )}
    </section>
  );
}
