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
  const packages = useLive("/api/admin/packages/options?purpose=onboarding"),
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
  const draftPackage =
    !!current && (!current.active || current.requiresLimitReview);
  const saveAsDraft = draftPackage || form.connection === "later";
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
              onChange={(v) => {
                const chosen = packages.data?.items.find(
                  (p: any) => p.id === v,
                );
                setForm({
                  ...form,
                  packageId: v,
                  connection:
                    chosen && (!chosen.active || chosen.requiresLimitReview)
                      ? "later"
                      : form.connection,
                });
              }}
              options={[
                { value: "", label: "Choose a package" },
                ...(packages.data?.items || []).map((p: any) => ({
                  value: p.id,
                  label: `${p.name}${!p.active || p.requiresLimitReview ? " — Draft" : ""}`,
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
            {!packages.isLoading &&
              !packages.error &&
              !packages.data?.items.length && (
                <p>
                  No email packages are available.{" "}
                  <Link
                    href="/admin/packages"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Create a package
                  </Link>
                  .
                </p>
              )}
            {draftPackage && (
              <p className="notice">
                You can continue with this package. The client will be saved as
                an inactive draft until the package limits are reviewed and a
                connection is added.
              </p>
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
                ?.filter((f: any) => f.enabled)
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
            {draftPackage ? (
              <p className="notice">
                Connect after saving this draft. Open the client’s Connection
                section when your clientspace ID and API key are ready.
              </p>
            ) : (
              <>
                <Field
                  name="connection"
                  label="Manyreach connection"
                  value={form.connection}
                  onChange={(v) => setForm({ ...form, connection: v })}
                  options={[
                    { value: "later", label: "Connect later — save as draft" },
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
                ) : form.connection === "new" ? (
                  <p className="notice">
                    A new isolated clientspace will be created through the API
                    with separate credits and automatic allocation disabled.
                    This requires a compatible agency plan.
                  </p>
                ) : (
                  <p className="notice">
                    Save the client now and add the connection from its details
                    page later.
                  </p>
                )}
                <p className="muted small">
                  The server verifies clientspace ownership and its isolated API
                  credentials.
                </p>
              </>
            )}
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
            {saveAsDraft ? (
              <p className="notice">
                This saves an inactive client draft. No invitation is created or
                sent. After reviewing the package limits and adding the
                connection, activate the workspace and send the owner
                invitation.
              </p>
            ) : (
              <>
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
                  ? !current || packages.isLoading || !!packages.error
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
                  saveAsDraft,
                  sendNow: saveAsDraft ? false : form.sendNow,
                  clientspaceId:
                    !saveAsDraft && form.connection === "existing"
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
            {busy
              ? "Saving workspace…"
              : saveAsDraft
                ? "Save client draft"
                : "Create client"}
          </Button>
        )}
      </div>
    </>
  );
}
