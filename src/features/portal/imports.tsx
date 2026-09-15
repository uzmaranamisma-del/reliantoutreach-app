"use client";
import { DataTable, ErrorBox, Field, Status } from "@/components/data";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/browser-api";
import { Upload } from "lucide-react";
import { useState } from "react";
import { useLive } from "./hooks";

export function ImportForm({
  campaign,
  list,
  onDone,
}: {
  campaign?: string;
  list?: string;
  onDone: () => void;
}) {
  const [csv, setCsv] = useState(""),
    [headers, setHeaders] = useState<string[]>([]),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [key] = useState(() => crypto.randomUUID());
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await api("/api/portal/imports", {
            csv,
            mapping,
            campaign,
            list,
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
      <p className="muted">
        Upload a CSV up to 2.5 MB. Imports run in batches and appear in Import
        activity.
      </p>
      <label className="upload-zone">
        <Upload size={27} />
        <strong>Choose a CSV file</strong>
        <span>UTF-8 · First row contains column names</span>
        <input
          type="file"
          accept=".csv,text/csv"
          required
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 2_500_000) {
              setError("Choose a file smaller than 2.5 MB.");
              return;
            }
            const text = await file.text();
            setCsv(text);
            const first = text.replace(/^\uFEFF/, "").split(/\r?\n/)[0];
            const cols =
              first
                .match(/("(?:[^"]|"")*"|[^,]+)(,|$)/g)
                ?.map((s) =>
                  s
                    .replace(/,$/, "")
                    .replace(/^"|"$/g, "")
                    .replaceAll('""', '"'),
                ) || [];
            setHeaders(cols);
            setMapping(
              Object.fromEntries(
                ["email", "firstName", "lastName", "company"].map((k) => [
                  k,
                  cols.find(
                    (c) =>
                      c.toLowerCase().replace(/[ _]/g, "") === k.toLowerCase(),
                  ) || "",
                ]),
              ),
            );
          }}
        />
      </label>
      {headers.length > 0 && (
        <div className="form-grid">
          {["email", "firstName", "lastName", "company"].map((k) => (
            <Field
              name={k}
              key={k}
              label={
                k === "email"
                  ? "Email (required)"
                  : k.replace(/([A-Z])/g, " $1")
              }
              required={k === "email"}
              value={mapping[k]}
              onChange={(v) => setMapping({ ...mapping, [k]: v })}
              options={[
                { value: "", label: "Do not import" },
                ...headers.map((h) => ({ value: h, label: h })),
              ]}
            />
          ))}
        </div>
      )}
      {error && <ErrorBox error={error} />}
      <div className="form-actions">
        <Button disabled={busy || !csv || !mapping.email}>
          {busy ? "Validating…" : "Validate & queue import"}
        </Button>
      </div>
    </form>
  );
}

export function ImportJobs() {
  const q = useLive("/api/portal/imports", 15);
  return (
    <section className="section-space">
      <div className="section-title">
        <h2>Import activity</h2>
      </div>
      <DataTable
        rows={q.data?.items || []}
        error={q.error}
        columns={[
          {
            key: "createdAt",
            label: "Started",
            render: (r: any) => new Date(r.createdAt).toLocaleString(),
          },
          {
            key: "status",
            label: "Status",
            render: (r: any) => <Status value={r.status} />,
          },
          {
            key: "progress",
            label: "Rows processed",
            render: (r: any) => `${r.progress} / ${r.total}`,
          },
          { key: "error", label: "Details" },
        ]}
      />
    </section>
  );
}
