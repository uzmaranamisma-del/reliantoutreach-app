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
import { ArrowLeft, ArrowRight, Check, Mail, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function Clients() {
  const router = useRouter();
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [create, setCreate] = useState(false);
  const q = useLive(
    `/api/admin/clients?page=${page}&search=${encodeURIComponent(search)}`,
  );
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
      <DataTable
        rows={q.data?.items || []}
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
  const packages = useLive("/api/admin/packages"),
    [step, setStep] = useState(0),
    [form, setForm] = useState<any>({
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
      connection: "existing",
      clientspaceId: "",
      sendNow: true,
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const labels = [
    "Client details",
    "Package",
    "Permissions",
    "Connection",
    "Invitation",
  ];
  const current = packages.data?.items.find(
    (p: any) => p.id === form.packageId,
  );
  return (
    <>
      <ol className="wizard-steps">
        {labels.map((l, i) => (
          <li
            key={l}
            className={i === step ? "current" : i < step ? "done" : ""}
          >
            <span>{i + 1}</span>
            {l}
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
              ["email", "Email"],
              ["phone", "Phone (optional)"],
              ["website", "Website (optional)"],
              ["industry", "Industry (optional)"],
              ["country", "Country"],
              ["timezone", "Timezone"],
            ].map(([k, l]) => (
              <Field
                key={k}
                name={k}
                label={l}
                type={k === "email" ? "email" : "text"}
                value={form[k]}
                onChange={(v) => setForm({ ...form, [k]: v })}
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
                ...(packages.data?.items || [])
                  .filter((p: any) => p.active)
                  .map((p: any) => ({ value: p.id, label: p.name })),
              ]}
            />
            {!packages.data?.items.length && (
              <p>Create a package before adding a client.</p>
            )}
          </>
        )}
        {step === 2 && (
          <>
            <p className="muted">
              These permissions come from{" "}
              {current?.name || "the selected package"}. Client overrides can be
              applied after creation.
            </p>
            <div className="permission-grid">
              {current?.features
                .filter((f: any) => f.enabled)
                .map((f: any) => (
                  <div className="permission-item" key={f.key}>
                    <Check size={15} />
                    {f.key}
                  </div>
                ))}
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <Field
              name="connection"
              label="Manyreach connection"
              value={form.connection}
              onChange={(v) => setForm({ ...form, connection: v })}
              options={[
                { value: "existing", label: "Map an existing clientspace" },
                { value: "new", label: "Create a new clientspace" },
              ]}
            />
            {form.connection === "existing" ? (
              <Field
                name="clientspaceId"
                label="Manyreach clientspace ID"
                type="number"
                value={form.clientspaceId}
                onChange={(v) => setForm({ ...form, clientspaceId: v })}
              />
            ) : (
              <p className="notice">
                A new isolated clientspace will be created through the API with
                separate credits and automatic allocation disabled. This
                requires a compatible agency plan.
              </p>
            )}
            <p className="muted small">
              The server verifies clientspace ownership and its isolated API
              credentials.
            </p>
          </>
        )}
        {step === 4 && (
          <>
            <div className="plan-banner">
              <div>
                <h2>{form.company}</h2>
                <p>
                  {form.email} · {current?.name}
                </p>
              </div>
              <Mail />
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={form.sendNow}
                onChange={(e) =>
                  setForm({ ...form, sendNow: e.target.checked })
                }
              />
              Queue the owner invitation now
            </label>
            <p className="muted">
              The secure link expires after 48 hours by default. Queued
              invitations are delivered by the cron processor.
            </p>
          </>
        )}
        {error && <ErrorBox error={error} />}
      </div>
      <div className="wizard-footer">
        <Button
          variant="outline"
          disabled={step === 0 || busy}
          onClick={() => setStep(step - 1)}
        >
          <ArrowLeft size={15} />
          Back
        </Button>
        {step < 4 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={
              step === 0
                ? !(
                    form.company &&
                    form.firstName &&
                    form.email &&
                    form.country
                  )
                : step === 1
                  ? !form.packageId
                  : false
            }
          >
            Continue
            <ArrowRight size={15} />
          </Button>
        ) : (
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await api("/api/admin/clients", {
                  ...form,
                  clientspaceId:
                    form.connection === "existing"
                      ? Number(form.clientspaceId)
                      : undefined,
                });
                onDone(result.id);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Creating workspace…" : "Create client"}
          </Button>
        )}
      </div>
    </>
  );
}
