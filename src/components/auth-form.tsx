"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ShieldCheck,
  Mail,
  ArrowRight,
  LogIn,
  LockKeyhole,
  Eye,
  EyeOff,
} from "lucide-react";
import { createAuthClient } from "better-auth/react";
import { Button } from "./ui/button";
import { useQuery } from "@tanstack/react-query";
import { defaultBranding, type Branding } from "@/lib/branding";
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
    [success, setSuccess] = useState(""),
    [showPassword, setShowPassword] = useState(false);
  const { data: branding = defaultBranding } = useQuery<Branding>({
    queryKey: ["branding"],
    queryFn: () => api("/api/branding"),
    staleTime: 300000,
  });
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || invite?.email || ""),
      password = String(form.get("password") || "");
    try {
      if (mode === "login") {
        const result = await auth.signIn.email({
          email,
          password,
          rememberMe: form.get("rememberMe") === "on",
        });
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
    <main className="auth-layout auth-reference">
      <section className="auth-story">
        <Link href="/login" className="brand">
          <Image
            className="auth-wordmark"
            src="/ui-kit/logos/reliantoutreach-logo-white.svg"
            alt="ReliantOutreach"
            width={210}
            height={26}
            priority
          />
        </Link>
        <div
          className="auth-visual"
          role="img"
          aria-label="Sample workspace with sending activity and a new reply"
        >
          <div className="auth-preview-stats">
            <span className="auth-preview-label">Sample workspace</span>
            <span>Emails sent this month</span>
            <div className="auth-preview-total">
              8,076 <small>+12.4%</small>
            </div>
            <div className="auth-preview-bars" aria-hidden="true">
              {[22, 32, 38, 28, 50, 72, 27].map((height, index) => (
                <i
                  key={index}
                  className={index === 5 ? "featured" : ""}
                  style={{ height: height + "%" }}
                />
              ))}
            </div>
          </div>
          <div className="auth-preview-reply">
            <span className="auth-preview-avatar">PL</span>
            <div>
              <strong>New reply received</strong>
              <small>Example company · 2 min ago</small>
            </div>
            <span className="auth-preview-status">Interested</span>
          </div>
        </div>
        <div className="auth-copy">
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
          <div className="auth-benefits">
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
        </div>
        <div className="auth-foot">
          <ShieldCheck size={18} /> Your workspace. Secure and private.
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-form">
          <div className="auth-icon">
            <LogIn size={20} />
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
                  <span className="auth-input-wrap">
                    <Mail size={17} aria-hidden="true" />
                    <input
                      type="email"
                      name="email"
                      required
                      readOnly={mode === "invite"}
                      defaultValue={invite?.email}
                      placeholder="you@company.com"
                      autoComplete="email"
                    />
                  </span>
                </label>
              )}
              {mode !== "forgot" && (
                <label>
                  Password
                  <span className="auth-input-wrap">
                    <LockKeyhole size={17} aria-hidden="true" />
                    <input
                      type={showPassword ? "text" : "password"}
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
                    <button
                      type="button"
                      className="auth-password-toggle"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </span>
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
                <div className="auth-login-options">
                  <label className="auth-remember">
                    <input type="checkbox" name="rememberMe" defaultChecked />
                    Keep me signed in
                  </label>
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
        <footer className="copyright auth-links">
          <span>© {new Date().getFullYear()} ReliantOutreach</span>
          {branding.privacyUrl && <a href={branding.privacyUrl}>Privacy</a>}
          <Link href={branding.termsUrl || "/terms"}>Terms</Link>
          <a
            href={`mailto:${branding.supportEmail || "info@reliantoutreach.com"}`}
          >
            Support
          </a>
        </footer>
      </section>
    </main>
  );
}
