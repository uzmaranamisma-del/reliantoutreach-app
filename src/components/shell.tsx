"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createAuthClient } from "better-auth/react";
import {
  LayoutDashboard,
  Send,
  Inbox,
  Users,
  FolderOpen,
  Mail,
  ChartNoAxesCombined,
  Settings,
  LifeBuoy,
  ChevronDown,
  Menu,
  LogOut,
  Building2,
  Package,
  ShieldCheck,
  Activity,
  ClipboardList,
  Clock,
  Layers,
  X,
} from "lucide-react";
import { api } from "@/lib/browser-api";
import { Button } from "./ui/button";
import { defaultBranding } from "@/lib/branding";
import type { ClientPreview } from "@/lib/client-preview";
const clientNav = [
  ["Dashboard", "", LayoutDashboard, ""],
  ["Campaigns", "campaigns", Send, "campaigns.view"],
  ["Inbox", "inbox", Inbox, "inbox.view"],
  ["Prospects", "prospects", Users, "prospects.view"],
  ["Lists", "lists", FolderOpen, "lists.manage"],
  ["Senders", "senders", Mail, "senders.view"],
  ["Analytics", "analytics", ChartNoAxesCombined, "analytics.view"],
  ["Team", "team", Users, "team.manage"],
  ["Usage", "usage", Layers, ""],
  ["Notifications", "notifications", Activity, ""],
  ["Settings", "settings", Settings, ""],
] as const;
const adminNav = [
  ["Overview", "", LayoutDashboard, ""],
  ["Clients", "clients", Building2, ""],
  ["Packages", "packages", Package, ""],
  ["Users", "users", Users, ""],
  ["Invitations", "invitations", Mail, ""],
  ["Jobs", "jobs", Clock, ""],
  ["System health", "system", Activity, ""],
  ["Audit log", "audit", ClipboardList, ""],
  ["Settings", "settings", Settings, ""],
] as const;
export function Shell({
  children,
  admin = false,
  name,
  preview,
}: {
  children: React.ReactNode;
  admin?: boolean;
  name: string;
  preview?: ClientPreview;
}) {
  const path = usePathname(),
    [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const menuButton = menuRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "Tab") {
        const controls = document.querySelectorAll<HTMLElement>(
          "#workspace-navigation a, #workspace-navigation button",
        );
        const first = controls[0],
          last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    const resize = () => {
      if (window.innerWidth > 760) setOpen(false);
    };
    window.addEventListener("keydown", close);
    window.addEventListener("resize", resize);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", close);
      window.removeEventListener("resize", resize);
      menuButton?.focus();
    };
  }, [open]);
  const { data: liveContext } = useQuery({
    queryKey: ["context"],
    queryFn: () => api("/api/portal/context"),
    enabled: !admin && !preview,
  });
  const { data: notificationSummary } = useQuery({
    queryKey: ["notification-summary"],
    queryFn: () => api("/api/portal/notifications?page=1"),
    enabled: !admin && !preview,
    refetchInterval: 30000,
  });
  const ctx = preview || liveContext;
  const base = preview
    ? `/admin/client-preview/${preview.id}`
    : admin
      ? "/admin"
      : "/app";
  const brandQuery = useQuery({
    queryKey: ["branding"],
    queryFn: () => api("/api/branding"),
    staleTime: 60000,
  });
  const brand = brandQuery.data || defaultBranding;
  const nav = admin ? adminNav : clientNav;
  const current =
    nav.find(([, slug]) =>
      slug ? path.startsWith(`${base}/${slug}`) : path === base,
    )?.[0] || "Workspace";
  return (
    <div
      className="shell"
      style={
        {
          "--blue": brand.accentColor,
          "--interaction": brand.accentColor,
        } as React.CSSProperties
      }
    >
      {open && (
        <button
          className="drawer-scrim"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside
        id="workspace-navigation"
        className={`sidebar ${open ? "sidebar-open" : ""}`}
      >
        <button
          ref={closeRef}
          className="drawer-close icon-button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        >
          <X size={22} />
        </button>
        <Link href={base} className="brand">
          <span className="brand-logo-frame">
            <Image
              className="brand-logo"
              src="/brand-logo.png"
              alt={brand.productName}
              width={2172}
              height={724}
              priority
            />
          </span>
        </Link>
        <div className="workspace-card">
          <span className="workspace-avatar">
            {admin ? (
              <ShieldCheck size={19} />
            ) : (
              ctx?.company?.slice(0, 1) || "R"
            )}
          </span>
          <div>
            <strong>
              {admin ? "Administration" : ctx?.company || "Your workspace"}
            </strong>
            <small>
              {admin ? "Superadmin" : ctx?.package || "Client workspace"}
            </small>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-label">{admin ? "PLATFORM" : "WORKSPACE"}</div>
        <nav>
          {nav
            .filter(([, , , p]) => !p || ctx?.permissions?.[p])
            .map(([label, slug, Icon]) => (
              <Link
                key={label}
                href={`${base}${slug ? `/${slug}` : ""}`}
                onClick={() => setOpen(false)}
                className={current === label ? "active" : ""}
              >
                <Icon size={19} />
                {label}
                {label === "Inbox" && <span className="nav-accent" />}
                {label === "Notifications" &&
                  notificationSummary?.unread > 0 && (
                    <span className="nav-badge">
                      {notificationSummary.unread > 99
                        ? "99+"
                        : notificationSummary.unread}
                    </span>
                  )}
              </Link>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <LifeBuoy size={20} />
            <strong>Need a hand?</strong>
            <p>
              {brand.supportEmail ? (
                <a href={`mailto:${brand.supportEmail}`}>Contact support</a>
              ) : (
                "Contact your workspace administrator for support."
              )}
            </p>
          </div>
          <button
            className="profile"
            onClick={async () => {
              await createAuthClient().signOut();
              // Full navigation clears the previous identity's query cache.
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.href = "/login";
            }}
          >
            <span className="profile-avatar">{name.slice(0, 1)}</span>
            <div>
              <strong>{name}</strong>
              <small>Sign out</small>
            </div>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell" inert={open || undefined}>
        <header className="topbar">
          <div>
            <button
              ref={menuRef}
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              aria-expanded={open}
              aria-controls="workspace-navigation"
              onClick={() => setOpen(true)}
            >
              {open ? <X /> : <Menu />}
            </button>
            <span className="muted">
              {admin ? "Administration" : "Workspace"}
            </span>
            <span className="breadcrumb-divider">/</span>
            <strong>{current}</strong>
          </div>
          <span className="workspace-indicator">
            <ShieldCheck size={15} />
            {preview
              ? "Client dashboard preview"
              : admin
                ? "Superadmin access"
                : "Private workspace"}
          </span>
        </header>
        {preview && (
          <div className="impersonation">
            <span>
              Preview only · {preview.company} · Workspace activation and
              sending are unchanged.
            </span>
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/clients/${preview.id}`}>
                Back to client setup
              </Link>
            </Button>
          </div>
        )}
        {!preview && ctx?.impersonating && (
          <div className="impersonation">
            Viewing as {ctx.company}
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await api("/api/admin/impersonation/stop", {});
                // Full navigation clears impersonated tenant data from memory.
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                window.location.href = "/admin";
              }}
            >
              Return to Superadmin
            </Button>
          </div>
        )}
        <main className="page-content">{children}</main>
        <footer className="app-footer">
          <span>{brand.productName}</span>
          <span>
            {brand.privacyUrl && (
              <a href={brand.privacyUrl} target="_blank" rel="noreferrer">
                Privacy policy ·{" "}
              </a>
            )}
            {brand.termsUrl && (
              <a href={brand.termsUrl} target="_blank" rel="noreferrer">
                Service terms
              </a>
            )}
          </span>
        </footer>
      </div>
    </div>
  );
}
