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
import { useLive } from "@/features/portal/hooks";
import { api } from "@/lib/browser-api";
import { limitKeys, permissions } from "@/lib/permissions";
import { ArrowLeft, Eye, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function ClientDetail({ id }: { id: string }) {
  const q = useLive(`/api/admin/clients/${id}`),
    packages = useLive("/api/admin/packages/options"),
    [dialog, setDialog] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [packageId, setPackageId] = useState(""),
    [member, setMember] = useState<any>();
  const c = q.data;
  async function action(name: string, data: any) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/clients/${id}/${name}`, data);
      if (name === "impersonate") {
        // Full navigation clears administrator queries when changing tenant context.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/app";
        return;
      }
      setDialog("");
      q.refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  return (
    <>
      <Link href="/admin/clients" className="back-link">
        <ArrowLeft size={16} />
        Clients
      </Link>
      <PageTitle
        title={c.company}
        description={`${c.firstName} ${c.lastName} · ${c.email}`}
      >
        <Status value={c.status} />
        <Button asChild variant="outline">
          <Link href={`/admin/client-preview/${c.id}`}>
            <Eye size={15} />
            Preview client dashboard
          </Link>
        </Button>
        <Button variant="outline" onClick={() => setDialog("edit")}>
          Edit client
        </Button>
        <Button
          variant="outline"
          disabled={c.status !== "ACTIVE"}
          onClick={() => action("impersonate", {})}
        >
          <Eye size={15} />
          Login as client
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            setDialog(c.status === "ACTIVE" ? "suspend" : "reactivate")
          }
        >
          {c.status === "ACTIVE"
            ? "Suspend"
            : c.status === "DRAFT"
              ? "Activate workspace"
              : "Reactivate"}
        </Button>
      </PageTitle>
      {error && <ErrorBox error={error} />}
      {c.status === "DRAFT" && (
        <div className="notice">
          <strong>Inactive client draft</strong>
          <p>
            Next: review and activate the package limits, add a verified
            clientspace connection, then activate this workspace and send the
            owner invitation.
          </p>
          <Link
            href="/admin/packages"
            target="_blank"
            rel="noopener noreferrer"
          >
            Review package limits
          </Link>
        </div>
      )}
      <div className="dashboard-grid">
        <div className="panel content-panel">
          <div className="section-title">
            <h2>Package & permissions</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPackageId(c.packageId);
                setDialog("package");
              }}
            >
              Change package
            </Button>
          </div>
          <h3>{c.package.name}</h3>
          <p className="muted">
            Package updates apply to the next protected request.
          </p>
          <Button variant="outline" onClick={() => setDialog("overrides")}>
            Edit client overrides
          </Button>
        </div>
        <div className="panel content-panel">
          <h2>Connection</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialog("connection")}
          >
            {c.mapping ? "Update connection key" : "Add connection"}
          </Button>
          <dl className="detail-grid">
            <div>
              <dt>Manyreach clientspace</dt>
              <dd>{c.mapping?.providerId || "Not mapped"}</dd>
            </div>
            <div>
              <dt>Last sync</dt>
              <dd>
                {c.mapping?.lastSyncAt
                  ? new Date(c.mapping.lastSyncAt).toLocaleString()
                  : "Not synced yet"}
              </dd>
            </div>
          </dl>
          <p className="muted">
            {c.country} · {c.timezone}
          </p>
        </div>
      </div>
      <div className="section-title section-space">
        <h2>Members</h2>
        <Button
          variant="outline"
          onClick={() =>
            action("invite", {
              email: c.email,
              name: `${c.firstName} ${c.lastName}`.trim(),
              role: "CLIENT_OWNER",
              sendNow: true,
            })
          }
          disabled={busy || c.status !== "ACTIVE"}
        >
          <Mail size={15} />
          Send owner invitation
        </Button>
      </div>
      <DataTable
        rows={c.memberships}
        actions={(r) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMember(r);
              setDialog("members");
            }}
          >
            Edit access
          </Button>
        )}
        columns={[
          { key: "name", label: "Name", render: (r: any) => r.user.name },
          { key: "email", label: "Email", render: (r: any) => r.user.email },
          { key: "role", label: "Role" },
          {
            key: "disabled",
            label: "Access",
            render: (r: any) => (r.disabled ? "Disabled" : "Active"),
          },
        ]}
      />
      <div className="section-title section-space">
        <h2>Invitations</h2>
      </div>
      <DataTable
        rows={c.invitations}
        columns={[
          { key: "email", label: "Email" },
          { key: "role", label: "Role" },
          {
            key: "status",
            label: "Status",
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
        ]}
      />
      <Modal
        open={!!dialog}
        onOpenChange={(v) => !v && setDialog("")}
        title={
          dialog === "edit"
            ? "Edit client"
            : dialog === "connection"
              ? c.mapping
                ? "Update connection key"
                : "Add clientspace connection"
              : dialog === "members"
                ? "Edit member access"
                : dialog === "package"
                  ? "Change package"
                  : dialog === "overrides"
                    ? "Client overrides"
                    : `${dialog === "suspend" ? "Suspend" : c.status === "DRAFT" ? "Activate" : "Reactivate"} client?`
        }
        wide={dialog === "overrides"}
      >
        {error && <ErrorBox error={error} />}
        {dialog === "edit" ? (
          <ClientEdit
            record={c}
            busy={busy}
            onSave={(data) => action("edit", data)}
          />
        ) : dialog === "connection" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              action("connection", {
                apiKey: form.get("apiKey"),
                ...(!c.mapping
                  ? { clientspaceId: Number(form.get("clientspaceId")) }
                  : {}),
              });
            }}
          >
            <p className="muted">
              {c.mapping
                ? "Enter a new key for the currently mapped clientspace. It will be verified before replacing the stored key."
                : "Enter this client's isolated clientspace ID and key. The connection will be verified before saving."}
            </p>
            {!c.mapping && (
              <label>
                Clientspace ID
                <input name="clientspaceId" type="number" min="1" required />
              </label>
            )}
            <label>
              Clientspace API key
              <input
                name="apiKey"
                type="password"
                autoComplete="off"
                required
              />
            </label>
            <div className="form-actions">
              <Button disabled={busy}>Verify & save key</Button>
            </div>
          </form>
        ) : dialog === "members" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action("members", {
                id: member.id,
                role: member.role,
                disabled: member.disabled,
              });
            }}
          >
            <p>{member?.user.email}</p>
            <Field
              name="role"
              label="Role"
              value={member?.role}
              onChange={(role) => setMember({ ...member, role })}
              options={["CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_MEMBER"].map(
                (value) => ({ value, label: value.replace("CLIENT_", "") }),
              )}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={member?.disabled || false}
                onChange={(e) =>
                  setMember({ ...member, disabled: e.target.checked })
                }
              />
              Disable workspace access
            </label>
            <div className="form-actions">
              <Button disabled={busy}>Save access</Button>
            </div>
          </form>
        ) : dialog === "package" ? (
          <>
            <Field
              name="packageId"
              label="Assigned package"
              value={packageId}
              onChange={setPackageId}
              options={(packages.data?.items || []).map((p: any) => ({
                value: p.id,
                label: p.name,
              }))}
            />
            <div className="form-actions">
              <Button
                disabled={busy}
                onClick={() => action("package", { packageId })}
              >
                Assign package
              </Button>
            </div>
          </>
        ) : dialog === "overrides" ? (
          <Overrides
            client={c}
            onSave={(data) => action("overrides", data)}
            busy={busy}
          />
        ) : (
          <>
            <p>
              {dialog === "suspend"
                ? "Client users will lose access to their workspace. Existing outreach continues in the provider; pause campaigns separately if required."
                : c.status === "DRAFT"
                  ? "The package must be active with reviewed limits, and a verified connection must be saved. Activation does not send an invitation; use Send owner invitation afterward."
                  : "Client users will regain workspace access."}
            </p>
            <div className="form-actions">
              <Button variant="outline" onClick={() => setDialog("")}>
                Cancel
              </Button>
              <Button
                disabled={busy}
                variant={dialog === "suspend" ? "destructive" : "default"}
                onClick={() => action(dialog, { confirm: true })}
              >
                Confirm
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

function ClientEdit({
  record,
  onSave,
  busy,
}: {
  record: any;
  onSave: (data: any) => void;
  busy: boolean;
}) {
  const fields = [
    "company",
    "firstName",
    "lastName",
    "email",
    "phone",
    "website",
    "industry",
    "country",
    "timezone",
  ];
  const [form, setForm] = useState<any>(
    Object.fromEntries(fields.map((k) => [k, record[k] || ""])),
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
      }}
    >
      <div className="form-grid">
        {fields.map((k) => (
          <Field
            key={k}
            name={k}
            label={k.replace(/([A-Z])/g, " $1")}
            type={k === "email" ? "email" : "text"}
            value={form[k]}
            onChange={(v) => setForm({ ...form, [k]: v })}
          />
        ))}
      </div>
      <div className="form-actions">
        <Button disabled={busy}>Save client</Button>
      </div>
    </form>
  );
}

export function Overrides({
  client,
  onSave,
  busy,
}: {
  client: any;
  onSave: (d: any) => void;
  busy: boolean;
}) {
  const [features, setFeatures] = useState<Record<string, string>>(
      Object.fromEntries(
        permissions.map((p) => [
          p,
          client.permissions.find((f: any) => f.key === p)?.enabled ===
          undefined
            ? "inherit"
            : client.permissions.find((f: any) => f.key === p).enabled
              ? "allow"
              : "deny",
        ]),
      ),
    ),
    [limits, setLimits] = useState<Record<string, string>>(
      Object.fromEntries(
        limitKeys.map((k) => [
          k,
          String(client.limits.find((l: any) => l.key === k)?.value ?? ""),
        ]),
      ),
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          permissions: Object.entries(features)
            .filter(([, v]) => v !== "inherit")
            .map(([key, v]) => ({ key, enabled: v === "allow" })),
          limits: Object.entries(limits)
            .filter(([, v]) => v !== "")
            .map(([key, v]) => ({ key, value: Number(v) })),
        });
      }}
    >
      <p className="muted">
        Inherit uses the package value. Blank limits inherit; -1 means
        unlimited.
      </p>
      <div className="form-grid three">
        {limitKeys.map((k) => (
          <Field
            key={k}
            name={k}
            label={k}
            type="text"
            value={limits[k]}
            onChange={(v) => setLimits({ ...limits, [k]: v })}
          />
        ))}
      </div>
      <div className="form-grid">
        {permissions.map((p) => (
          <Field
            key={p}
            name={p}
            label={p}
            value={features[p]}
            onChange={(v) => setFeatures({ ...features, [p]: v })}
            options={[
              { value: "inherit", label: "Inherit package" },
              { value: "allow", label: "Allow" },
              { value: "deny", label: "Deny" },
            ]}
          />
        ))}
      </div>
      <div className="form-actions">
        <Button disabled={busy}>Save overrides</Button>
      </div>
    </form>
  );
}
