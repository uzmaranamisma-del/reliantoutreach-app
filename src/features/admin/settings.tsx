"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorBox, Field, Loading, PageTitle } from "@/components/data";
import { Button } from "@/components/ui/button";
import { useLive } from "@/features/portal/hooks";
import { api } from "@/lib/browser-api";
import type { Branding } from "@/lib/branding";
export function AdminSettings() {
  const q = useLive("/api/admin/settings");
  return (
    <>
      <PageTitle
        title="Platform settings"
        description="Manage your workspace name, support contact and policy links."
      />
      {q.error ? (
        <ErrorBox error={q.error} />
      ) : q.data ? (
        <BrandingForm initial={q.data} />
      ) : (
        <Loading />
      )}
    </>
  );
}
function BrandingForm({ initial }: { initial: Branding }) {
  const [form, setForm] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const cache = useQueryClient();
  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setSaved(false);
        try {
          await api("/api/admin/settings", form);
          await cache.invalidateQueries({ queryKey: ["branding"] });
          setSaved(true);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        {(
          [
            ["productName", "Product name"],
            ["supportEmail", "Support email"],
            ["websiteUrl", "Website URL"],
            ["privacyUrl", "Privacy policy URL"],
            ["termsUrl", "Service terms URL"],
            ["accentColor", "Accent color (hex)"],
          ] as const
        ).map(([key, label]) => (
          <Field
            key={key}
            name={key}
            label={label}
            value={form[key]}
            onChange={(value) => {
              setForm({ ...form, [key]: value });
              setSaved(false);
            }}
          />
        ))}
      </div>
      <p className="muted">
        Policy links are optional. Use your published HTTPS policy pages.
      </p>
      {error && <ErrorBox error={error} />}
      {saved && <p role="status">Settings saved.</p>}
      <div className="form-actions">
        <Button disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button>
      </div>
    </form>
  );
}
