"use client";
import { useState } from "react";
import { ResourcePicker } from "@/components/resource-picker";
import { Button } from "@/components/ui/button";
import { ErrorBox, Field } from "@/components/data";
import { api } from "@/lib/browser-api";
export function EnrollmentForm({
  campaign,
  sourceList,
  prospects,
  onDone,
}: {
  campaign?: string;
  sourceList?: string;
  prospects?: string[];
  onDone: () => void;
}) {
  const [target, setTarget] = useState(campaign || ""),
    [source, setSource] = useState(sourceList || ""),
    [kind, setKind] = useState<"campaigns" | "lists">("campaigns"),
    [key] = useState(() => crypto.randomUUID()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await api("/api/portal/enrollments", {
            key,
            ...(prospects ? { prospects } : { sourceList: source }),
            ...(kind === "campaigns" ? { campaign: target } : { list: target }),
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
        Existing prospects are enrolled in batches. Campaigns must be draft or
        paused. Track progress in Import activity.
      </p>
      {!sourceList && !prospects && (
        <ResourcePicker
          kind="lists"
          label="Source list"
          value={source}
          onChange={setSource}
        />
      )}{" "}
      {!campaign && (
        <>
          <Field
            name="destinationType"
            label="Destination"
            value={kind}
            onChange={(v) => {
              setKind(v);
              setTarget("");
            }}
            options={[
              { value: "campaigns", label: "Campaign" },
              { value: "lists", label: "List" },
            ]}
          />
          <ResourcePicker
            kind={kind}
            label="Destination"
            value={target}
            onChange={setTarget}
          />
        </>
      )}
      {error && <ErrorBox error={error} />}
      <div className="form-actions">
        <Button disabled={busy || !target || (!source && !prospects?.length)}>
          {busy ? "Queuing…" : "Queue enrollment"}
        </Button>
      </div>
    </form>
  );
}
