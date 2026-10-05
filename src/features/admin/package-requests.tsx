"use client";
import { useState } from "react";
import { useLive } from "@/features/portal/hooks";
import { api } from "@/lib/browser-api";
import { Button } from "@/components/ui/button";
import { ErrorBox } from "@/components/data";
type Order = {
  id: string;
  packageName: string;
  currency: string;
  price: string;
  status: string;
  note?: string;
  createdAt: string;
  history: { status: string; at: string; note?: string }[];
};
export function PackageRequests({
  clientId,
  onActivated,
}: {
  clientId: string;
  onActivated: () => void;
}) {
  const q = useLive(`/api/admin/clients/${clientId}/orders`),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function update(order: Order, status: string) {
    if (
      !window.confirm(
        status === "activated"
          ? `Activate ${order.packageName} for this client? This changes their live package. Confirm commercial arrangements separately; no payment is collected here.`
          : `${status === "approved" ? "Approve" : status === "fulfilled" ? "Mark fulfilled" : "Decline"} this package request?`,
      )
    )
      return;
    const note = window.prompt("Optional message for the client", "");
    if (note === null) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/clients/${clientId}/orders`, {
        id: order.id,
        status,
        note,
        confirm: true,
      });
      await q.refetch();
      onActivated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel content-panel section-space">
      <h2>Package requests</h2>
      <p className="muted">
        Requests from the mobile app. Approval does not change the active
        package; activate it after confirming arrangements.
      </p>
      {(error || q.error) && <ErrorBox error={error || q.error} />}
      {q.isLoading ? (
        <p>Loading requests…</p>
      ) : !q.data?.items?.length ? (
        <p className="muted">No package requests yet.</p>
      ) : (
        q.data.items.map((order: Order) => (
          <article
            key={order.id}
            style={{
              padding: "18px 0",
              borderTop: "1px solid var(--border, #e5e7eb)",
            }}
          >
            <strong>{order.packageName}</strong> · {order.currency}{" "}
            {order.price}/month
            <p>
              {order.status.replaceAll("_", " ")} ·{" "}
              {new Date(order.createdAt).toLocaleDateString()}
            </p>
            {order.note && <p>{order.note}</p>}
            <details>
              <summary>Status history</summary>
              {order.history.map((h, i) => (
                <p key={i}>
                  {h.status.replaceAll("_", " ")} ·{" "}
                  {new Date(h.at).toLocaleString()} {h.note}
                </p>
              ))}
            </details>
            {["pending_review", "approved"].includes(order.status) && (
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  marginTop: 12,
                }}
              >
                <Button
                  disabled={busy}
                  onClick={() =>
                    update(
                      order,
                      order.status === "approved" ? "activated" : "approved",
                    )
                  }
                >
                  {order.status === "approved"
                    ? "Activate package"
                    : "Approve request"}
                </Button>
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() => update(order, "declined")}
                >
                  Decline
                </Button>
                {order.status === "approved" && (
                  <Button
                    disabled={busy}
                    variant="outline"
                    onClick={() => update(order, "fulfilled")}
                  >
                    Mark other service fulfilled
                  </Button>
                )}
              </div>
            )}
          </article>
        ))
      )}
    </section>
  );
}
