"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createAuthClient } from "better-auth/react";
import {
  ArrowUpRight,
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
] as const;
export function Shell({
  children,
  admin = false,
  name,
}: {
  children: React.ReactNode;
  admin?: boolean;
  name: string;
}) {
  const path = usePathname(),
    [open, setOpen] = useState(false);
  const { data: ctx } = useQuery({
    queryKey: ["context"],
    queryFn: () => api("/api/portal/context"),
    enabled: !admin,
  });
  const base = admin ? "/admin" : "/app";
  const nav = admin ? adminNav : clientNav;
  const current =
    nav.find(([, slug]) =>
      slug ? path.startsWith(`${base}/${slug}`) : path === base,
    )?.[0] || "Workspace";
  return (
    <div className="shell">
      {open && (
        <button
          className="drawer-scrim"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <Link href={base} className="brand">
          <span className="brand-mark">
            <ArrowUpRight size={23} />
          </span>
          Reliant<span>Outreach</span>
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
              </Link>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <LifeBuoy size={20} />
            <strong>Need a hand?</strong>
            <p>Contact your workspace administrator for support.</p>
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
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="mobile-menu icon-button"
              aria-label="Open navigation"
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
            {admin ? "Superadmin access" : "Private workspace"}
          </span>
        </header>
        {ctx?.impersonating && (
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
          <span>ReliantOutreach</span>
          <span>Your next conversation starts here.</span>
        </footer>
      </div>
    </div>
  );
}
