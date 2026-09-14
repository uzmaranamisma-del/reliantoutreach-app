"use client";
import {
  DataTable,
  ErrorBox,
  Field,
  Loading,
  PageTitle,
  Status,
} from "@/components/data";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { api } from "@/lib/browser-api";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useContext, useLive } from "./hooks";

export function Usage() {
  const q = useLive("/api/portal/usage", 45);
  return (
    <>
      <PageTitle
        eyebrow="YOUR WORKSPACE"
        title="Package & usage"
        description="Your plan, included services, and current capacity."
      />
      {q.error ? (
        <ErrorBox error={q.error} />
      ) : q.isLoading ? (
        <Loading />
      ) : (
        <>
          <div className="plan-banner">
            <div>
              <span className="eyebrow">CURRENT PACKAGE</span>
              <h2>{q.data.package}</h2>
              <p>
                {q.data.plan.currency}{" "}
                {Number(q.data.plan.price).toLocaleString()}{" "}
                {q.data.billingLabel} · {q.data.plan.currency}{" "}
                {Number(q.data.plan.setupPrice).toLocaleString()} setup
              </p>
              <p>{q.data.plan.description}</p>
            </div>
            <span className="status">Managed by your administrator</span>
          </div>
          <div className="dashboard-grid section-space">
            {[
              ["Setup includes", q.data.plan.setupIncludes],
              ["Monthly services", q.data.plan.monthlyIncludes],
            ].map(([label, items]) => (
              <section key={label} className="panel content-panel">
                <h2>{label}</h2>
                <ul>
                  {(Array.isArray(items) ? items : []).map((text: string) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <p className="notice">
            Minimum commitment: {q.data.plan.minimumMonths} months.{" "}
            {q.data.plan.commercialTerms}
          </p>
          <div className="usage-grid">
            {Object.entries(q.data.limits).map(([key, value]) => {
              const used = q.data.snapshot?.values?.[key];
              return (
                <div className="panel usage-card" key={key}>
                  <h3>{key.replace(/([A-Z])/g, " $1")}</h3>
                  <p>
                    <strong>
                      {used === undefined ? "—" : Number(used).toLocaleString()}
                    </strong>{" "}
                    / {value === -1 ? "Unlimited" : String(value)}
                  </p>
                  <div className="progress-track">
                    <div
                      style={{
                        width:
                          used === undefined || value === -1
                            ? "0%"
                            : `${Math.min(100, (used / Math.max(1, Number(value))) * 100)}%`,
                      }}
                    />
                  </div>
                  <small>
                    {key === "monthlyEmails"
                      ? "Monthly sending is unavailable for capped packages."
                      : key === "csvRows"
                        ? "Maximum rows per import."
                        : used === undefined
                          ? "Awaiting a usage snapshot."
                          : "Latest synchronized usage."}
                  </small>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

export function Team() {
  const { data: ctx } = useContext();
  const q = useLive("/api/portal/team"),
    [invite, setInvite] = useState(false),
    [form, setForm] = useState({ name: "", email: "", role: "CLIENT_MEMBER" }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [remove, setRemove] = useState<any>(),
    [edit, setEdit] = useState<any>();
  return (
    <>
      <PageTitle
        eyebrow="WORKSPACE"
        title="Your team"
        description="The people working alongside you."
      >
        <Button onClick={() => setInvite(true)}>
          <Plus size={16} />
          Invite teammate
        </Button>
      </PageTitle>
      {error && <ErrorBox error={error} />}
      <DataTable
        rows={q.data?.items || []}
        loading={q.isLoading}
        error={q.error}
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
        actions={(r) =>
          ctx?.role === "CLIENT_OWNER" &&
          r.role !== "CLIENT_OWNER" && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEdit(r)}>
                Edit role
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setRemove(r)}>
                Remove
              </Button>
            </>
          )
        }
      />
      <div className="section-title section-space">
        <h2>Pending invitations</h2>
      </div>
      <DataTable
        rows={q.data?.invitations || []}
        actions={(r) => (
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              try {
                await api(`/api/portal/team/${r.id}/revoke`, {});
                q.refetch();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Revoke
          </Button>
        )}
        columns={[
          { key: "email", label: "Email" },
          { key: "role", label: "Role" },
          {
            key: "expiresAt",
            label: "Expires",
            render: (r: any) => new Date(r.expiresAt).toLocaleString(),
          },
        ]}
      />
      <Modal
        open={!!edit}
        onOpenChange={(v) => !v && setEdit(undefined)}
        title="Change team role"
      >
        <p>{edit?.user.email}</p>
        <Field
          name="role"
          label="Role"
          value={edit?.role}
          onChange={(role) => setEdit({ ...edit, role })}
          options={[
            { value: "CLIENT_ADMIN", label: "Administrator" },
            { value: "CLIENT_MEMBER", label: "Member (read access)" },
          ]}
        />
        <div className="form-actions">
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`/api/portal/team/${edit.id}`, { role: edit.role });
                setEdit(undefined);
                q.refetch();
              } catch (e) {
                setError((e as Error).message);
                setEdit(undefined);
              } finally {
                setBusy(false);
              }
            }}
          >
            Save role
          </Button>
        </div>
      </Modal>
      <Modal open={invite} onOpenChange={setInvite} title="Invite a teammate">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api("/api/portal/team", { ...form, sendNow: true });
              setInvite(false);
              q.refetch();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field
            name="name"
            label="Full name"
            required
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
          />
          <Field
            name="email"
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
          />
          <Field
            name="role"
            label="Role"
            value={form.role}
            onChange={(v) => setForm({ ...form, role: v })}
            options={[
              { value: "CLIENT_MEMBER", label: "Member (read access)" },
              { value: "CLIENT_ADMIN", label: "Administrator" },
            ]}
          />
          <div className="form-actions">
            <Button disabled={busy}>Send invitation</Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={!!remove}
        onOpenChange={(v) => !v && setRemove(undefined)}
        title="Remove team member?"
      >
        <p>{remove?.user.email} will lose access to this workspace.</p>
        <div className="form-actions">
          <Button variant="outline" onClick={() => setRemove(undefined)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              try {
                await api(`/api/portal/team/${remove.id}`, {
                  action: "remove",
                  confirm: true,
                });
                setRemove(undefined);
                q.refetch();
              } catch (e) {
                setError((e as Error).message);
                setRemove(undefined);
              }
            }}
          >
            Remove access
          </Button>
        </div>
      </Modal>
    </>
  );
}

export function Settings() {
  const { data: ctx } = useContext();
  return (
    <>
      <PageTitle
        eyebrow="ACCOUNT"
        title="Settings"
        description="Your profile and workspace details."
      />
      <div className="panel content-panel">
        <h2>Workspace</h2>
        <dl className="detail-grid">
          {[
            ["Company", ctx?.company],
            ["Timezone", ctx?.timezone],
            ["Role", ctx?.role],
            ["Email", ctx?.email],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v || "—"}</dd>
            </div>
          ))}
        </dl>
        <p className="muted">
          Contact your administrator to update workspace details or package
          access.
        </p>
        <Button asChild variant="outline">
          <Link href="/forgot-password">Reset password</Link>
        </Button>
      </div>
    </>
  );
}
