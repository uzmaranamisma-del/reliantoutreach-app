"use client";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Moon, Sun, Monitor } from "lucide-react";
import { api } from "@/lib/browser-api";
import { ErrorBox } from "./data";
type Preference = "dark" | "light" | "system";
declare global {
  interface Window {
    ROTheme?: {
      get(): Preference;
      set(value: Preference): void;
      resolve(value: Preference): string;
    };
  }
}
function usePreference() {
  return useQuery<{ themePreference: Preference }>({
    queryKey: ["appearance"],
    queryFn: () => api("/api/me/preferences"),
    staleTime: Infinity,
    retry: false,
  });
}
export function ThemeSync() {
  const { data } = usePreference();
  useEffect(() => {
    if (data) window.ROTheme?.set(data.themePreference);
  }, [data]);
  return null;
}
export function Appearance() {
  const q = usePreference(),
    cache = useQueryClient();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const preference = q.data?.themePreference || "dark";
  async function choose(value: Preference) {
    if (busy || !q.data) return;
    setBusy(true);
    setError("");
    setSaved(false);
    window.ROTheme?.set(value);
    try {
      const next = await api("/api/me/preferences", { themePreference: value });
      cache.setQueryData(["appearance"], next);
      setSaved(true);
    } catch (e) {
      window.ROTheme?.set(preference);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="ro-card appearance-card"
      aria-labelledby="appearance-title"
    >
      <div className="ro-formcard__section">
        <div>
          <h2 id="appearance-title" className="ro-card__title">
            Appearance
          </h2>
          <p>
            Choose how your workspace looks. Your preference follows your
            account across devices.
          </p>
        </div>
        <div>
          <div className="ro-themes" role="group" aria-label="Color theme">
            {(
              [
                ["dark", "Dark", Moon],
                ["light", "Light", Sun],
                ["system", "Match system", Monitor],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                className="ro-theme"
                aria-pressed={preference === value}
                disabled={busy || !q.data}
                onClick={() => choose(value)}
              >
                <span
                  className={`ro-theme__art ro-theme__art--${value}`}
                  aria-hidden="true"
                >
                  {value === "system" ? (
                    <>
                      <i className="half-d" />
                      <i className="half-l" />
                    </>
                  ) : (
                    <>
                      <i className="side">
                        <b />
                        <b />
                        <b />
                      </i>
                      <i className="main">
                        <b />
                        <b />
                        <b />
                        <b />
                      </i>
                    </>
                  )}
                </span>
                <span className="ro-theme__label">
                  <Icon size={16} />
                  {label}
                </span>
              </button>
            ))}
          </div>
          <p className="ro-card__sub" role="status">
            {busy
              ? "Saving preference…"
              : saved
                ? "Appearance saved to your account."
                : "Dark, light, or automatically match your device."}
          </p>
        </div>
      </div>
      {(error || q.error) && <ErrorBox error={error || q.error} />}
    </section>
  );
}
