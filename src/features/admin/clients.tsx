"use client";
import {
  DataTable,
  ErrorBox,
  Field,
  PageTitle,
  Refresh,
  Status,
} from "@/components/data";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { useLive } from "@/features/portal/hooks";
import { api } from "@/lib/browser-api";
import { permissions } from "@/lib/permissions";
import { ArrowLeft, ArrowRight, Mail, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function Clients() {
  const router = useRouter();
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [create, setCreate] = useState(false),
    [selectedIds, setSelectedIds] = useState<string[]>([]),
    [deleting, setDeleting] = useState(false),
    [deleteError, setDeleteError] = useState("");
  const q = useLive(
    `/api/admin/clients?page=${page}&search=${encodeURIComponent(search)}`,
  );
  const rows = q.data?.items || [];
  const allVisibleSelected =
    rows.length > 0 && rows.every((row: any) => selectedIds.includes(row.id));
  const toggleSelected = (id: string) =>
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  async function deleteSelected() {
    if (!selectedIds.length || deleting) return;
    const confirmed = window.confirm(
      `Delete ${selectedIds.length} selected client${selectedIds.length === 1 ? "" : "s"}? This removes the local workspace and its access records.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await api("/api/admin/clients/bulk-delete", {
        ids: selectedIds,
        confirm: true,
      });
      setSelectedIds([]);
      await q.refetch();
    } catch (e) {
      setDeleteError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }
  async function updateSelectedStatus(status: "ACTIVE" | "SUSPENDED") {
    if (!selectedIds.length || deleting) return;
    const label = status === "ACTIVE" ? "reactivate" : "suspend";
    if (!window.confirm(`${label[0].toUpperCase() + label.slice(1)} ${selectedIds.length} selected client${selectedIds.length === 1 ? "" : "s"}?`)) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await api("/api/admin/clients/bulk-status", {
        ids: selectedIds,
        status,
        confirm: true,
      });
      setSelectedIds([]);
      await q.refetch();
    } catch (e) {
      setDeleteError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="WORKSPACES"
        title="Clients"
        description="Manage every client from one place."
      >
        <Refresh onClick={() => q.refetch()} />
        <Button onClick={() => setCreate(true)}>
          <Plus size={16} />
          Create client
        </Button>
      </PageTitle>
      {deleteError && <ErrorBox error={deleteError} />}
      <div className="selection-toolbar">
        <label className="check">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={(event) =>
              setSelectedIds(
                event.target.checked
                  ? Array.from(new Set([...selectedIds, ...rows.map((row: any) => row.id)]))
                  : selectedIds.filter(
                      (id) => !rows.some((row: any) => row.id === id),
                    ),
              )
            }
          />
          Select all visible
        </label>
        <span className="muted small">
          {selectedIds.length ? `${selectedIds.length} selected` : "Select clients for bulk actions"}
        </span>
        {selectedIds.length > 0 && (
          <>
            <Button size="sm" variant="outline" disabled={deleting} onClick={() => updateSelectedStatus("ACTIVE")}>
              Reactivate
            </Button>
            <Button size="sm" variant="outline" disabled={deleting} onClick={() => updateSelectedStatus("SUSPENDED")}>
              Suspend
            </Button>
            <Button variant="destructive" size="sm" disabled={deleting} onClick={deleteSelected}>
              <Trash2 size={15} />
              {deleting ? "Working…" : "Delete selected"}
            </Button>
          </>
        )}
      </div>
      <DataTable
        rows={rows}
        loading={q.isLoading}
        error={q.error}
        search={search}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        page={page}
        total={q.data?.total}
        onPage={setPage}
        columns={[
          {
            key: "select",
            label: "Select",
            render: (r: any) => (
              <input
                type="checkbox"
                aria-label={`Select ${r.company}`}
                checked={selectedIds.includes(r.id)}
                onChange={() => toggleSelected(r.id)}
              />
            ),
          },
          {
            key: "company",
            label: "Company",
            render: (r: any) => (
              <Link className="strong-link" href={`/admin/clients/${r.id}`}>
                {r.company}
              </Link>
            ),
          },
          { key: "email", label: "Owner email" },
          {
            key: "package",
            label: "Package",
            render: (r: any) => r.package.name,
          },
          {
            key: "status",
            label: "Status",
            render: (r: any) => <Status value={r.status} />,
          },
          {
            key: "connection",
            label: "Connection",
            render: (r: any) => (
              <Status
                value={
                  !r.mapping
                    ? "Unmapped"
                    : r.mapping.lastError
                      ? "Error"
                      : r.mapping.lastSyncAt
                        ? "Synced"
                        : "Pending"
                }
              />
            ),
          },
          {
            key: "createdAt",
            label: "Created",
            render: (r: any) => new Date(r.createdAt).toLocaleDateString(),
          },
        ]}
      />
      <Modal
        open={create}
        onOpenChange={setCreate}
        title="Create a client workspace"
        wide
      >
        <ClientWizard
          onDone={(id) => {
            router.push(`/admin/clients/${id}`);
          }}
        />
      </Modal>
    </>
  );
}

export function ClientWizard({ onDone }: { onDone: (id: string) => void }) {
  const packages = useLive("/api/admin/packages/options?purpose=onboarding");
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [createdId, setCreatedId] = useState(""),
    [apiKey, setApiKey] = useState(""),
    [key] = useState(() => crypto.randomUUID());
  const [form, setForm] = useState<any>({
    company: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    website: "",
    industry: "",
    country: "",
    timezone: "UTC",
    packageId: "",
    permissions: permissions.map((key) => ({ key, enabled: true })),
  });
  const labels = ["Client details", "Package", "Permissions", "Sync & invite"];
  const current = packages.data?.items.find(
    (p: any) => p.id === form.packageId,
  );
  async function save(sync: boolean) {
    if (
      sync &&
      (apiKey.trim().length < 8 ||
        current?.serviceType !== "EMAIL" ||
        !current?.active ||
        current?.requiresLimitReview)
    ) {
      setError(
        "Choose an active email package and enter the client's API key before synchronizing.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      let id = createdId;
      if (!id) {
        const saved = await api("/api/admin/clients", {
          ...form,
          connection: "later",
          saveAsDraft: true,
          sendNow: false,
        });
        id = saved.id;
        setCreatedId(id);
      }
      if (sync)
        await api(`/api/admin/clients/${id}/sync`, {
          key,
          apiKey: apiKey.trim(),
        });
      setApiKey("");
      onDone(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <ol className="wizard-steps">
        {labels.map((label, i) => (
          <li
            key={label}
            className={i === step ? "current" : i < step ? "done" : ""}
          >
            <span>{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <div className="wizard-body">
        <h2>{labels[step]}</h2>
        {step === 0 && (
          <div className="form-grid">
            {[
              ["company", "Company"],
              ["firstName", "First name"],
              ["lastName", "Last name"],
              ["email", "Owner email"],
              ["phone", "Phone (optional)"],
              ["website", "Website (optional)"],
              ["industry", "Industry (optional)"],
              ["country", "Country"],
              ["timezone", "Timezone"],
            ].map(([name, label]) => (
              <Field
                key={name}
                name={name}
                label={label}
                type={name === "email" ? "email" : "text"}
                value={form[name]}
                onChange={(v) => setForm({ ...form, [name]: v })}
              />
            ))}
          </div>
        )}
        {step === 1 && (
          <>
            <Field
              name="package"
              label="Package"
              value={form.packageId}
              onChange={(v) => setForm({ ...form, packageId: v })}
              options={[
                { value: "", label: "Choose a package" },
                ...(packages.data?.items || []).map((p: any) => ({
                  value: p.id,
                  label: `${p.name} · ${p.serviceType === "LINKEDIN" ? "LinkedIn service" : "Email outreach"}${!p.active || p.requiresLimitReview ? " — Inactive" : " — Active"}`,
                })),
              ]}
            />
            {packages.isLoading && <p>Loading packages…</p>}
            {packages.error && (
              <ErrorBox
                error={packages.error}
                retry={() => packages.refetch()}
              />
            )}
            {current && (!current.active || current.requiresLimitReview) && (
              <p className="notice">
                This package is not ready for activation. You can save the
                client as a draft.
              </p>
            )}
            {current && current.serviceType === "LINKEDIN" && (
              <p className="notice">
                LinkedIn Outreach is shown for reference and can be saved as a
                draft, but it cannot activate an email workspace.
              </p>
            )}
            {current && (
              <p className="muted package-selection-meta">
                ${Number(current.price || 0).toLocaleString()}/month · $
                {Number(current.setupPrice || 0).toLocaleString()} setup
                {current.serviceType === "LINKEDIN"
                  ? ` · ${Number(current.initialMessages || 0).toLocaleString()} initial messages, then ${Number(current.monthlyMessages || 0).toLocaleString()}/month`
                  : ` · ${Number(current.limits?.find((limit: any) => limit.key === "monthlyEmails")?.value || 0).toLocaleString()} emails/month`}
              </p>
            )}
          </>
        )}
        {step === 2 && (
          <>
            <label className="check">
              <input
                type="checkbox"
                checked={form.permissions.length === permissions.length}
                onChange={(e) =>
                  setForm({
                    ...form,
                    permissions: e.target.checked
                      ? permissions.map((key) => ({ key, enabled: true }))
                      : [],
                  })
                }
              />
              Select all permissions
            </label>
            <div className="permission-grid">
              {permissions.map((key) => (
                <label className="check" key={key}>
                  <input
                    type="checkbox"
                    checked={form.permissions.some(
                      (item: any) => item.key === key && item.enabled,
                    )}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        permissions: e.target.checked
                          ? [
                              ...form.permissions.filter(
                                (item: any) => item.key !== key,
                              ),
                              { key, enabled: true },
                            ]
                          : form.permissions.filter(
                              (item: any) => item.key !== key,
                            ),
                      })
                    }
                  />
                  {key}
                </label>
              ))}
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <div className="plan-banner">
              <div>
                <h3>{form.company}</h3>
                <p>
                  {form.email} · {current?.name}
                </p>
              </div>
              <Mail />
            </div>
            <label>
              Manyreach workspace / clientspace API key
              <input
                name="manyreachApiKey"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste this client's isolated API key"
              />
            </label>
            <p className="muted">
              Use the isolated workspace or clientspace key, or an agency key
              when the Manyreach Workspace or Clientspace name exactly matches
              this client. Campaigns, prospects, lists, senders and replies are
              checked before the owner invitation is queued.
            </p>
            {createdId && (
              <p className="notice">
                Client draft saved. Correct the connection and retry; this will
                reuse the same client.
              </p>
            )}
          </>
        )}
        {error && <ErrorBox error={error} />}
      </div>
      <div className="wizard-footer">
        <Button
          variant="outline"
          disabled={step === 0 || busy || !!createdId}
          onClick={() => {
            setError("");
            setStep(step - 1);
          }}
        >
          <ArrowLeft size={15} />
          Back
        </Button>
        {step < 3 ? (
          <Button
            onClick={() => {
              setError("");
              setStep(step + 1);
            }}
            disabled={
              step === 0
                ? !(
                    form.company &&
                    form.firstName &&
                    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
                    form.country.trim().length >= 2
                  )
                : step === 1 &&
                    (!current || packages.isLoading || !!packages.error)
            }
          >
            Continue
            <ArrowRight size={15} />
          </Button>
        ) : (
          <div className="title-actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => save(false)}
            >
              Save draft
            </Button>
            <Button
              disabled={
                busy ||
                apiKey.trim().length < 8 ||
                current?.serviceType !== "EMAIL" ||
                !current?.active ||
                current?.requiresLimitReview
              }
              onClick={() => save(true)}
            >
              {busy ? "Preparing workspace…" : "Sync & Invite"}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
