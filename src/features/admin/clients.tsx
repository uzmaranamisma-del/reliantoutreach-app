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
import { ArrowLeft, ArrowRight, Mail, Plus } from "lucide-react";
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
  });
  const labels = ["Client details", "Package", "Sync & invite"];
  const current = packages.data?.items.find(
    (p: any) => p.id === form.packageId,
  );
  async function save(sync: boolean) {
    if (
      sync &&
      (apiKey.trim().length < 8 ||
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
            {current && (!current.active || current.requiresLimitReview) && (
              <p className="notice">
                This package is not ready for activation. You can save the
                client as a draft.
              </p>
            )}
          </>
        )}
        {step === 2 && (
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
        {step < 2 ? (
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
                : !current || packages.isLoading || !!packages.error
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
