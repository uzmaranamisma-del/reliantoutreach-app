"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorBox, Field, Loading, PageTitle } from "@/components/data";
import { Button } from "@/components/ui/button";
import { useLive } from "@/features/portal/hooks";
import { api } from "@/lib/browser-api";
import type { Branding } from "@/lib/branding";
import { Appearance } from "@/components/appearance";
import { AiConnectionNotice } from "@/features/portal/ai-workspace";
export function AdminSettings() {
  const q = useLive("/api/admin/settings");
  return (
    <>
      <PageTitle
        title="Platform settings"
        description="Manage your workspace name, support contact and policy links."
      />
      <Appearance />
      <section className="panel content-panel ai-admin-setup">
        <h2>AI platform setup</h2>
        <AiConnectionNotice />
        <p>Clients can prepare business knowledge and reply preferences in AI Workspace. Provider connection and AI processing are not enabled in this release.</p>
      </section>
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
      className="panel branding-form ro-formcard"
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
      <section className="ro-formcard__section">
        <div>
          <h2 className="ro-card__title">Workspace identity</h2>
          <p>Your name, accent color, and support details.</p>
        </div>
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
      </section>
      <div className="ro-formcard__foot">
        <p className="muted">
          Policy links are optional. Use your published HTTPS policy pages.
        </p>
        {error && <ErrorBox error={error} />}
        {saved && <p role="status">Settings saved.</p>}
        <div className="form-actions">
          <Button disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button>
        </div>
      </div>
    </form>
  );
}
