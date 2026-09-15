"use client";
import {
  DataTable,
  ErrorBox,
  Field,
  PageTitle,
  Refresh,
} from "@/components/data";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { CampaignBuilder } from "@/features/campaign-builder";
import { api } from "@/lib/browser-api";
import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { columnsByKind, resourceFields } from "./config";
import { useContext, useLive } from "./hooks";
import { ImportForm, ImportJobs } from "./imports";
import { EnrollmentForm } from "./enrollment";
import { ResourceDetails } from "./resource-details";
type RecordData = Record<string, any>;
export function Resources({ kind }: { kind: string }) {
  const router = useRouter();
  const { data: ctx } = useContext(),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [debounced, setDebounced] = useState(""),
    [status, setStatus] = useState(""),
    [editor, setEditor] = useState<any>(undefined),
    [builder, setBuilder] = useState(false),
    [importOpen, setImportOpen] = useState(false),
    [selected, setSelected] = useState<any>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<string>();
  const [enroll, setEnroll] = useState<any>(),
    [checked, setChecked] = useState<string[]>([]),
    [cursorPages, setCursorPages] = useState<string[]>([""]);
  async function editRecord(r: any) {
    setBusy(true);
    try {
      setEditor(await api(`/api/portal/${kind}/${r.id}`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  const query = useLive(
    `/api/portal/${kind}?page=${cursorPages[page - 1] ? 1 : page}${cursorPages[page - 1] ? `&cursor=${encodeURIComponent(cursorPages[page - 1])}` : ""}${["prospects", "senders"].includes(kind) && debounced ? `&search=${encodeURIComponent(debounced)}` : ""}${status ? `&status=${status}` : ""}`,
    kind === "campaigns" ? ctx?.poll.campaigns || 25 : 0,
  );
  const can = (v: string) =>
    ctx?.permissions[kind === "lists" ? "lists.manage" : `${kind}.${v}`];
  const items = (query.data?.items || []).filter((r: any) =>
    ["campaigns", "lists"].includes(kind)
      ? String(r.name || r.title)
          .toLowerCase()
          .includes(search.toLowerCase())
      : true,
  );
  const singular = {
    campaigns: "campaign",
    prospects: "prospect",
    lists: "list",
    senders: "sender",
  }[kind];
  return (
    <>
      <PageTitle
        eyebrow="OUTREACH"
        title={kind[0].toUpperCase() + kind.slice(1)}
        description={
          {
            campaigns:
              "Build meaningful conversations, one campaign at a time.",
            prospects: "The people behind your next opportunity.",
            lists: "Organize your contacts into focused audiences.",
            senders: "Manage the email accounts powering your outreach.",
          }[kind]
        }
      >
        <Refresh onClick={() => query.refetch()} busy={query.isFetching} />
        {kind === "prospects" && can("import") && (
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload size={16} />
            Import CSV
          </Button>
        )}
        {can("create") && (
          <Button
            onClick={() =>
              kind === "campaigns" ? setBuilder(true) : setEditor(null)
            }
          >
            <Plus size={16} />
            New {singular}
          </Button>
        )}
      </PageTitle>
      {kind === "campaigns" && (
        <div className="tabs">
          {["", "Running", "Draft", "Paused", "Completed"].map((s) => (
            <button
              key={s}
              className={status === s ? "selected" : ""}
              onClick={() => {
                setStatus(s);
                setPage(1);
                setCursorPages([""]);
              }}
            >
              {s || "All campaigns"}
            </button>
          ))}
        </div>
      )}
      {error && <ErrorBox error={error} />}
      {kind === "prospects" && can("import") && checked.length > 0 && (
        <div className="toolbar">
          <span>{checked.length} selected</span>
          <Button onClick={() => setEnroll({ prospects: checked })}>
            Add to campaign or list
          </Button>
          <Button variant="ghost" onClick={() => setChecked([])}>
            Clear selection
          </Button>
        </div>
      )}
      <DataTable
        rows={items}
        columns={
          kind === "prospects" && can("import")
            ? [
                {
                  key: "selected",
                  label: "Select",
                  render: (r: any) => (
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.email}`}
                      checked={checked.includes(r.id)}
                      onChange={(e) =>
                        setChecked(
                          e.target.checked
                            ? [...checked, r.id]
                            : checked.filter((id) => id !== r.id),
                        )
                      }
                    />
                  ),
                },
                ...columnsByKind[kind],
              ]
            : columnsByKind[kind]
        }
        loading={query.isLoading}
        error={query.error}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
          setCursorPages([""]);
          setChecked([]);
        }}
        search={search}
        searchLabel={
          ["campaigns", "lists"].includes(kind)
            ? "Search current page…"
            : `Search ${kind}…`
        }
        page={page}
        total={query.data?.pagination.totalItems}
        onPage={(p) => {
          if (p > page && query.data?.pagination?.nextCursor)
            setCursorPages([
              ...cursorPages.slice(0, page),
              query.data.pagination.nextCursor,
            ]);
          setPage(p);
          setChecked([]);
        }}
        actions={(r) => (
          <>
            {kind !== "campaigns" && (
              <Button size="sm" variant="ghost" onClick={() => setDetail(r.id)}>
                View details
              </Button>
            )}
            {kind === "lists" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelected(r);
                  setImportOpen(true);
                }}
              >
                Add prospects
              </Button>
            )}
            {kind === "lists" && ctx?.permissions["prospects.import"] && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEnroll({ sourceList: r.id })}
              >
                Enroll list
              </Button>
            )}
            {can("edit") && (
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Edit ${singular}`}
                disabled={busy}
                onClick={() => editRecord(r)}
              >
                <Pencil size={15} />
              </Button>
            )}
            {can("delete") && (
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Delete ${singular}`}
                onClick={() => setSelected({ ...r, delete: true })}
              >
                <Trash2 size={15} />
              </Button>
            )}
          </>
        )}
      />
      <Modal
        open={!!detail}
        onOpenChange={(open) => !open && setDetail(undefined)}
        title={`${singular} details`}
        wide
      >
        {detail && (
          <ResourceDetails
            key={detail}
            kind={kind}
            id={detail}
            canViewProspects={!!ctx?.permissions["prospects.view"]}
          />
        )}
      </Modal>
      <Modal
        open={editor !== undefined}
        onOpenChange={(v) => !v && setEditor(undefined)}
        title={`${editor ? "Edit" : "New"} ${singular}`}
        wide={kind === "senders"}
      >
        {editor !== undefined && (
          <ResourceEditor
            kind={kind}
            record={editor}
            onClose={() => setEditor(undefined)}
            onDone={() => {
              setEditor(undefined);
              query.refetch();
            }}
          />
        )}
      </Modal>
      <Modal
        open={!!selected?.delete}
        onOpenChange={(v) => !v && setSelected(undefined)}
        title={`Delete ${singular}?`}
        description="This removes the record from your outreach workspace."
      >
        <p>{selected?.name || selected?.email || selected?.title}</p>
        <div className="form-actions">
          <Button variant="outline" onClick={() => setSelected(undefined)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`/api/portal/${kind}/${selected.id}`, {
                  action: "delete",
                  confirm: true,
                });
                setSelected(undefined);
                query.refetch();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Delete {singular}
          </Button>
        </div>
      </Modal>
      <Modal
        open={builder}
        onOpenChange={setBuilder}
        title="Create a campaign"
        wide
      >
        <CampaignBuilder
          onDone={(id) => {
            router.push(`/app/campaigns/${id}`);
          }}
        />
      </Modal>
      <Modal
        open={!!enroll}
        onOpenChange={(v) => !v && setEnroll(undefined)}
        title="Enroll existing prospects"
      >
        {enroll && (
          <EnrollmentForm
            {...enroll}
            onDone={() => {
              setEnroll(undefined);
              setChecked([]);
              query.refetch();
            }}
          />
        )}
      </Modal>
      <Modal
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import prospects"
        wide
      >
        <ImportForm
          list={selected && !selected.delete ? selected.id : undefined}
          onDone={() => {
            setImportOpen(false);
            query.refetch();
          }}
        />
      </Modal>
      {kind === "prospects" && ctx?.permissions["prospects.import"] && (
        <ImportJobs />
      )}
    </>
  );
}

export function ResourceEditor({
  kind,
  record,
  onDone,
  onClose,
}: {
  kind: string;
  record?: any;
  onDone: () => void;
  onClose: () => void;
}) {
  const [key] = useState(() => crypto.randomUUID());
  const fields = resourceFields[kind].filter(
    (f) =>
      !(
        record &&
        kind === "senders" &&
        (f.key === "email" || f.key.startsWith("custom"))
      ),
  );
  const [form, setForm] = useState<RecordData>({
      ...Object.fromEntries(
        fields.map((f) => [
          f.key,
          record?.[f.key] ??
            (f.type === "number"
              ? f.key === "dailyLimit"
                ? 50
                : f.key === "customSmtpPort"
                  ? 587
                  : 993
              : ""),
        ]),
      ),
      ...(kind === "campaigns"
        ? Object.fromEntries(
            [
              "scheduleSending",
              "trackOpens",
              "trackClicks",
              ...["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].flatMap(
                (day) => [`send${day}`, `send${day}After`, `send${day}Before`],
              ),
            ].map((k) => [
              k,
              record?.[k] ??
                (k.endsWith("After")
                  ? 540
                  : k.endsWith("Before")
                    ? 1020
                    : false),
            ]),
          )
        : kind === "senders" && record
          ? { warmup: record.warmup ?? false }
          : {}),
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const data = record
            ? Object.fromEntries(
                Object.entries(form).filter(([k, v]) => v !== record[k]),
              )
            : form;
          await api(`/api/portal/${kind}${record ? `/${record.id}` : ""}`, {
            data,
            version: record?.version,
            key,
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
        {fields.map((f) => (
          <Field
            key={f.key}
            name={f.key}
            label={f.label}
            type={f.type}
            required={f.required}
            value={form[f.key]}
            onChange={(v) => setForm({ ...form, [f.key]: v })}
          />
        ))}
      </div>
      {kind === "campaigns" && (
        <>
          <h3>Sending schedule</h3>
          <div className="permission-grid">
            {[
              ["scheduleSending", "Use a sending schedule"],
              ["trackOpens", "Track opens"],
              ["trackClicks", "Track clicks"],
            ].map(([k, label]) => (
              <label className="check" key={k}>
                <input
                  type="checkbox"
                  checked={!!form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
          {form.scheduleSending &&
            ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div className="schedule-row" key={day}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={!!form[`send${day}`]}
                    onChange={(e) =>
                      setForm({ ...form, [`send${day}`]: e.target.checked })
                    }
                  />
                  {day}
                </label>
                {["After", "Before"].map((part, i) => {
                  const k = `send${day}${part}`,
                    minutes = Number(form[k] || 0);
                  return (
                    <label key={k}>
                      {i ? "End" : "Start"}
                      <input
                        type="time"
                        value={`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`}
                        onChange={(e) => {
                          const [h, m] = e.target.value.split(":").map(Number);
                          setForm({ ...form, [k]: h * 60 + m });
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            ))}
        </>
      )}
      {kind === "senders" && record && (
        <label className="check">
          <input
            type="checkbox"
            checked={!!form.warmup}
            onChange={(e) => setForm({ ...form, warmup: e.target.checked })}
          />
          Enable warmup
        </label>
      )}
      {kind === "senders" && !record && (
        <p className="muted small">
          Credentials are sent securely to connect this account. Stored
          passwords are never displayed.
        </p>
      )}
      {error && <ErrorBox error={error} />}
      <div className="form-actions">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={busy}>
          {busy ? "Saving…" : record ? "Save changes" : "Create"}
        </Button>
      </div>
    </form>
  );
}
