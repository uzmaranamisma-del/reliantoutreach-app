"use client";
import { Empty, ErrorBox, Field, PageTitle, Status } from "@/components/data";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { useLive } from "@/features/portal/hooks";
import { api } from "@/lib/browser-api";
import { limitKeys, permissions } from "@/lib/permissions";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";

export function Packages() {
  const q = useLive("/api/admin/packages"),
    [editing, setEditing] = useState<any>(undefined);
  return (
    <>
      <PageTitle
        eyebrow="ACCESS & CAPACITY"
        title="Packages"
        description="Define what each workspace can do."
      >
        <Button onClick={() => setEditing(null)}>
          <Plus size={16} />
          Create package
        </Button>
      </PageTitle>
      {q.error && <ErrorBox error={q.error} />}
      <div className="package-grid">
        {q.data?.items.map((p: any) => (
          <section className="panel package-card" key={p.id}>
            <div className="section-title">
              <h2>{p.name}</h2>
              <Status value={p.active ? "Active" : "Inactive"} />
            </div>
            <p>{p.description}</p>
            <div className="package-price">
              {Number(p.price).toLocaleString()}
              <small>{p.billingLabel}</small>
            </div>
            <p className="muted">{p._count.clients} assigned clients</p>
            <div className="package-limits">
              {p.limits.map((l: any) => (
                <div key={l.key}>
                  <span>{l.key.replace(/([A-Z])/g, " $1")}</span>
                  <strong>
                    {l.value === -1 ? "Unlimited" : l.value.toLocaleString()}
                  </strong>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              className="full"
              onClick={() => setEditing(p)}
            >
              <Pencil size={15} />
              Edit package
            </Button>
          </section>
        ))}
      </div>
      {q.data?.items.length === 0 && (
        <div className="panel">
          <Empty
            title="Your packages start here"
            description="Create a package, then assign it to a client workspace."
          />
        </div>
      )}
      <Modal
        open={editing !== undefined}
        onOpenChange={(v) => !v && setEditing(undefined)}
        title={editing ? "Edit package" : "Create package"}
        wide
      >
        {editing !== undefined && (
          <PackageForm
            record={editing}
            onDone={() => {
              setEditing(undefined);
              q.refetch();
            }}
          />
        )}
      </Modal>
    </>
  );
}

export function PackageForm({
  record,
  onDone,
}: {
  record?: any;
  onDone: () => void;
}) {
  const [form, setForm] = useState<any>({
      name: record?.name || "",
      description: record?.description || "",
      price: Number(record?.price || 0),
      billingLabel: record?.billingLabel || "per month",
      active: record?.active ?? true,
      displayOrder: record?.displayOrder || 0,
      features: permissions.map((key) => ({
        key,
        enabled:
          record?.features.find((f: any) => f.key === key)?.enabled ?? false,
      })),
      limits: limitKeys.map((key) => ({
        key,
        value: record?.limits.find((l: any) => l.key === key)?.value ?? 0,
      })),
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api(
            `/api/admin/packages${record ? `/${record.id}` : ""}`,
            form,
          );
          onDone();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        {[
          ["name", "Package name", "text"],
          ["price", "Price (display only)", "number"],
          ["billingLabel", "Billing label", "text"],
          ["displayOrder", "Display order", "number"],
        ].map(([k, l, t]) => (
          <Field
            key={k}
            name={k}
            label={l}
            type={t}
            value={form[k]}
            onChange={(v) => setForm({ ...form, [k]: v })}
            required
          />
        ))}
      </div>
      <Field
        name="description"
        label="Description"
        type="textarea"
        value={form.description}
        onChange={(v) => setForm({ ...form, description: v })}
      />
      <label className="check">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => setForm({ ...form, active: e.target.checked })}
        />
        Active package
      </label>
      <h3>Usage limits</h3>
      <p className="notice">
        Use 0 to disable capacity and -1 for unlimited. Finite monthly email
        caps block starting campaigns and replying because strict ongoing
        enforcement is not available in the verified API. Other limits are
        enforced before creation/import.
      </p>
      <div className="form-grid three">
        {form.limits.map((l: any, i: number) => (
          <Field
            key={l.key}
            name={l.key}
            label={l.key.replace(/([A-Z])/g, " $1")}
            type="number"
            min={-1}
            value={l.value}
            onChange={(v) =>
              setForm({
                ...form,
                limits: form.limits.map((x: any, j: number) =>
                  j === i ? { ...x, value: v } : x,
                ),
              })
            }
          />
        ))}
      </div>
      <h3>Feature permissions</h3>
      <div className="permission-grid">
        {form.features.map((f: any, i: number) => (
          <label className="check" key={f.key}>
            <input
              type="checkbox"
              checked={f.enabled}
              onChange={(e) =>
                setForm({
                  ...form,
                  features: form.features.map((x: any, j: number) =>
                    j === i ? { ...x, enabled: e.target.checked } : x,
                  ),
                })
              }
            />
            {f.key.replaceAll(".", " · ")}
          </label>
        ))}
      </div>
      {error && <ErrorBox error={error} />}
      <div className="form-actions">
        <Button disabled={busy}>{busy ? "Saving…" : "Save package"}</Button>
      </div>
    </form>
  );
}
