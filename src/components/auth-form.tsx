"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShieldCheck, Mail, ArrowRight } from "lucide-react";
import { createAuthClient } from "better-auth/react";
import { Button } from "./ui/button";
import { api } from "@/lib/browser-api";
const auth = createAuthClient();
export function AuthForm({
  mode = "login",
  token,
  invite,
}: {
  mode?: "login" | "forgot" | "reset" | "invite";
  token?: string;
  invite?: { name: string; email: string; company: string };
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || invite?.email || ""),
      password = String(form.get("password") || "");
    try {
      if (mode === "login") {
        const result = await auth.signIn.email({ email, password });
        if (result.error)
          throw new Error(result.error.message || "Unable to sign in.");
        // Full navigation clears any in-memory data from a previous identity.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/app";
      }
      if (mode === "forgot") {
        const result = await auth.requestPasswordReset({
          email,
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (result.error) throw new Error(result.error.message);
        setSuccess(
          "If this email has an account, a password reset link will arrive shortly.",
        );
      }
      if (mode === "reset") {
        if (password !== form.get("confirmPassword"))
          throw new Error("Passwords do not match.");
        const result = await auth.resetPassword({
          newPassword: password,
          token,
        });
        if (result.error) throw new Error(result.error.message);
        setSuccess("Your password has been reset. You can now sign in.");
      }
      if (mode === "invite") {
        await api("/api/invitations/accept", {
          token,
          name: form.get("name"),
          password: password || undefined,
          confirmPassword: password ? form.get("confirmPassword") : undefined,
          acceptTerms: form.get("acceptTerms") === "on",
        });
        setSuccess(
          "Your workspace is ready. Sign in with your account to continue.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to continue.");
    } finally {
      setBusy(false);
    }
  }
  const title = {
    login: "Welcome back",
    forgot: "Reset your password",
    reset: "Choose a new password",
    invite: "Your workspace is ready",
  }[mode];
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Link href="/login" className="brand">
          <span className="brand-logo-frame">
            <Image
              className="brand-logo"
              src="/brand-logo.png"
              alt="ReliantOutreach"
              width={2172}
              height={724}
              priority
            />
          </span>
        </Link>
        <div>
          <span className="eyebrow">YOUR OUTREACH. ONE WORKSPACE.</span>
          <h1>
            Good conversations
            <br />
            start here<span>.</span>
          </h1>
          <p>
            Bring your campaigns, prospects, and conversations together. Keep
            your next opportunity in sight.
          </p>
          <div className="story-line">
            <span>01</span>
            <div>Reach the right people</div>
          </div>
          <div className="story-line">
            <span>02</span>
            <div>Make every follow-up count</div>
          </div>
          <div className="story-line">
            <span>03</span>
            <div>Turn replies into relationships</div>
          </div>
        </div>
        <div className="auth-foot">
          <ShieldCheck size={18} /> Your workspace. Secure and private.
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-form">
          <div className="auth-icon">
            <Mail size={24} />
          </div>
          <h2>{title}</h2>
          <p className="muted">
            {mode === "login"
              ? "Sign in to your ReliantOutreach account."
              : mode === "invite"
                ? `Join ${invite?.company}.`
                : "We’ll help you get back to your workspace."}
          </p>
          {success ? (
            <div className="success-message" role="status">
              {success}
              <Link href="/login" className="text-link">
                Continue to sign in <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <form onSubmit={submit}>
              {mode === "invite" && (
                <label>
                  Full name
                  <input
                    name="name"
                    required
                    defaultValue={invite?.name}
                    autoComplete="name"
                  />
                </label>
              )}
              {mode !== "reset" && (
                <label>
                  Email address
                  <input
                    type="email"
                    name="email"
                    required
                    readOnly={mode === "invite"}
                    defaultValue={invite?.email}
                    placeholder="you@company.com"
                    autoComplete="email"
                  />
                </label>
              )}
              {mode !== "forgot" && (
                <label>
                  Password
                  <input
                    type="password"
                    name="password"
                    required={mode !== "invite"}
                    minLength={mode === "login" ? undefined : 12}
                    maxLength={128}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    placeholder={
                      mode === "login"
                        ? "Enter your password"
                        : "At least 12 characters"
                    }
                  />
                </label>
              )}
              {(mode === "reset" || mode === "invite") && (
                <label>
                  Confirm password
                  <input
                    type="password"
                    name="confirmPassword"
                    autoComplete="new-password"
                  />
                </label>
              )}
              {mode === "invite" && (
                <>
                  <p className="muted small">
                    Already have an account? Sign in first, then return to this
                    invitation and leave the password fields empty.
                  </p>
                  <label className="check">
                    <input type="checkbox" name="acceptTerms" required /> I
                    agree to the{" "}
                    <Link href="/terms" target="_blank">
                      workspace terms
                    </Link>
                    .
                  </label>
                </>
              )}
              {mode === "login" && (
                <div className="align-right">
                  <Link href="/forgot-password" className="text-link">
                    Forgot password?
                  </Link>
                </div>
              )}
              {error && (
                <div className="error-message" role="alert">
                  {error}
                </div>
              )}
              <Button type="submit" disabled={busy} className="full">
                {busy
                  ? "Please wait…"
                  : mode === "login"
                    ? "Sign in"
                    : mode === "forgot"
                      ? "Send reset link"
                      : mode === "reset"
                        ? "Save password"
                        : "Accept invitation"}
                <ArrowRight size={17} />
              </Button>
            </form>
          )}
          <p className="auth-note">
            {mode === "login" ? (
              "New here? Ask your workspace administrator for an invitation."
            ) : (
              <Link href="/login">Back to sign in</Link>
            )}
          </p>
        </div>
        <div className="copyright">
          © {new Date().getFullYear()} ReliantOutreach
        </div>
      </section>
    </main>
  );
}
