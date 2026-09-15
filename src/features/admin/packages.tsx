"use client";
import {
  Empty,
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
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";

export function Packages() {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState("");
  const q = useLive(
      `/api/admin/packages?page=${page}&search=${encodeURIComponent(search)}`,
    ),
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
      {q.isLoading && <Loading />}
      <div className="toolbar">
        <input
          aria-label="Search packages"
          placeholder="Search packages…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <div className="package-grid">
        {q.data?.items.map((p: any) => (
          <section className="panel package-card" key={p.id}>
            <div className="section-title">
              <h2>{p.name}</h2>
              <Status value={p.active ? "Active" : "Draft"} />
            </div>
            <p>{p.description}</p>
            <div className="package-price">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: p.currency || "USD",
                maximumFractionDigits: 0,
              }).format(Number(p.price))}
              <small>{p.billingLabel}</small>
            </div>
            <p className="muted">{p._count.clients} assigned clients</p>
            <p>
              <strong>
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: p.currency || "USD",
                  maximumFractionDigits: 0,
                }).format(Number(p.setupPrice || 0))}
              </strong>{" "}
              one-time setup · {p.minimumMonths || 0}-month minimum
            </p>
            {p.requiresLimitReview && (
              <p className="notice">
                Draft: sender, campaign, prospect, list and team limits await
                your review.
              </p>
            )}
            {p.serviceType === "LINKEDIN" && (
              <p className="notice">
                Managed LinkedIn service · {p.initialMessages} initial messages,
                then {p.monthlyMessages?.toLocaleString()} per month. Email
                workspace assignment is unavailable for this service.
              </p>
            )}
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
            <details className="package-services">
              <summary>Included services & terms</summary>
              <h3>Setup includes</h3>
              <ul>
                {(p.setupIncludes || []).map((s: string) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <h3>Monthly management</h3>
              <ul>
                {(p.monthlyIncludes || []).map((s: string) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <p className="muted small">{p.commercialTerms}</p>
              {p.sourceUrl && (
                <a href={p.sourceUrl} target="_blank" rel="noreferrer">
                  Published package details
                </a>
              )}
            </details>
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
      <div className="table-footer">
        <Button
          variant="outline"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </Button>
        <span>
          Page {page} · {q.data?.total || 0} packages
        </span>
        <Button
          variant="outline"
          disabled={page * 25 >= (q.data?.total || 0)}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
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
      setupPrice: Number(record?.setupPrice || 0),
      currency: record?.currency || "USD",
      serviceType: record?.serviceType || "EMAIL",
      minimumMonths: record?.minimumMonths || 0,
      setupIncludes: record?.setupIncludes || [],
      monthlyIncludes: record?.monthlyIncludes || [],
      commercialTerms: record?.commercialTerms || "",
      sourceUrl: record?.sourceUrl || "",
      initialMessages: record?.initialMessages ?? null,
      monthlyMessages: record?.monthlyMessages ?? null,
      requiresLimitReview: record?.requiresLimitReview ?? false,
      active: record?.active ?? true,
      displayOrder: record?.displayOrder || 0,
      features: permissions.map((key) => ({
        key,
        enabled:
          record?.features.find((f: any) => f.key === key)?.enabled ?? false,
      })),
      limits: limitKeys.map((key) => ({
        key,
        value: record?.limits.find((l: any) => l.key === key)?.value ?? "",
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
          await api(`/api/admin/packages${record ? `/${record.id}` : ""}`, {
            ...form,
            limits: form.limits.filter((l: any) => l.value !== ""),
            setupIncludes: form.setupIncludes
              .map((s: string) => s.trim())
              .filter(Boolean),
            monthlyIncludes: form.monthlyIncludes
              .map((s: string) => s.trim())
              .filter(Boolean),
          });
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
          ["price", "Monthly fee", "number"],
          ["setupPrice", "One-time setup fee", "number"],
          ["minimumMonths", "Minimum commitment (months)", "number"],
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
      <div className="form-grid">
        <Field
          name="currency"
          label="Currency"
          value={form.currency}
          onChange={(v) => setForm({ ...form, currency: v })}
          options={["USD", "GBP", "EUR", "PKR"].map((value) => ({
            value,
            label: value,
          }))}
        />
        <Field
          name="serviceType"
          label="Service"
          value={form.serviceType}
          onChange={(v) => setForm({ ...form, serviceType: v })}
          options={[
            { value: "EMAIL", label: "Email outreach" },
            { value: "LINKEDIN", label: "LinkedIn managed service" },
          ]}
        />
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => setForm({ ...form, active: e.target.checked })}
        />
        Active package
      </label>
      {form.requiresLimitReview && (
        <p className="notice">
          Website pricing does not specify all technical limits. Enter the
          agreed limits below, then confirm your review.
        </p>
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={!form.requiresLimitReview}
          onChange={(e) =>
            setForm({
              ...form,
              requiresLimitReview: !e.target.checked,
              active: e.target.checked ? form.active : false,
            })
          }
        />
        Resource limits have been reviewed
      </label>
      <div className="form-grid">
        {["setupIncludes", "monthlyIncludes"].map((k) => (
          <Field
            key={k}
            name={k}
            type="textarea"
            label={
              k === "setupIncludes"
                ? "Setup services (one per line)"
                : "Monthly services (one per line)"
            }
            value={form[k].join("\n")}
            onChange={(v) => setForm({ ...form, [k]: v.split("\n") })}
          />
        ))}
      </div>
      {form.serviceType === "LINKEDIN" && (
        <div className="form-grid">
          {["initialMessages", "monthlyMessages"].map((k) => (
            <Field
              key={k}
              name={k}
              label={
                k === "initialMessages"
                  ? "Initial LinkedIn messages"
                  : "Monthly LinkedIn messages"
              }
              type="number"
              value={form[k] ?? 0}
              onChange={(v) => setForm({ ...form, [k]: Number(v) })}
            />
          ))}
        </div>
      )}
      <Field
        name="commercialTerms"
        label="Commercial terms"
        type="textarea"
        value={form.commercialTerms}
        onChange={(v) => setForm({ ...form, commercialTerms: v })}
      />
      <Field
        name="sourceUrl"
        label="Published source URL"
        value={form.sourceUrl}
        onChange={(v) => setForm({ ...form, sourceUrl: v })}
      />
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
