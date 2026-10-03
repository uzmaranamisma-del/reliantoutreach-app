"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import { ThemeSync } from "./appearance";
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
  Bell,
  Search,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/browser-api";
import { Button } from "./ui/button";
import { defaultBranding } from "@/lib/branding";
import type { ClientPreview } from "@/lib/client-preview";
const clientNav = [
  ["Dashboard", "", LayoutDashboard, ""],
  ["Campaigns", "campaigns", Send, "campaigns.view"],
  ["Inbox", "inbox", Inbox, "inbox.view"],
  ["AI Workspace", "ai-workspace", Sparkles, ""],
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
    [open, setOpen] = useState(false),
    [navSearch, setNavSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
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
          "#workspace-navigation a, #workspace-navigation button, #workspace-navigation input",
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
      if (window.innerWidth > 900) setOpen(false);
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
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () =>
      document.documentElement.style.setProperty(
        "--app-height",
        `${viewport?.height || window.innerHeight}px`,
      );
    resize();
    viewport?.addEventListener("resize", resize);
    return () => {
      viewport?.removeEventListener("resize", resize);
      document.documentElement.style.removeProperty("--app-height");
    };
  }, []);
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
  const visibleNav = nav.filter(
    ([, , , permission]) => !permission || ctx?.permissions?.[permission],
  );
  const primarySlugs = admin
    ? ["", "clients", "packages"]
    : ["", "inbox", "campaigns"];
  const mobileNav = visibleNav.filter(([, slug]) =>
    primarySlugs.includes(slug),
  );
  const groupFor = (slug: string) =>
    admin
      ? "Platform"
      : ["analytics", "usage", "notifications"].includes(slug)
        ? "Insights"
        : ["team", "settings"].includes(slug)
          ? "Account"
          : "Workspace";
  const navGroups = (
    admin ? ["Platform"] : ["Workspace", "Insights", "Account"]
  ).map((group) => ({
    group,
    items: visibleNav.filter(
      ([label, slug]) =>
        groupFor(slug) === group &&
        label.toLowerCase().includes(navSearch.toLowerCase()),
    ),
  }));
  const current =
    nav.find(([, slug]) =>
      slug ? path.startsWith(`${base}/${slug}`) : path === base,
    )?.[0] || "Workspace";
  return (
    <div
      className="shell ro-shell"
      style={
        {
          ...(brand.accentColor !== defaultBranding.accentColor
            ? { "--brand": brand.accentColor }
            : {}),
        } as React.CSSProperties
      }
    >
      <ThemeSync />
      {open && (
        <button
          className="drawer-scrim"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside
        id="workspace-navigation"
        className={`sidebar ro-sidebar ${open ? "sidebar-open" : ""}`}
      >
        <button
          ref={closeRef}
          className="drawer-close icon-button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        >
          <X size={22} />
        </button>
        <Link
          href={base}
          className="brand ro-brand"
          onClick={() => setOpen(false)}
        >
          <Image
            className="ro-logo ro-logo--dark"
            src="/ui-kit/logos/reliantoutreach-logo-white.svg"
            alt={brand.productName}
            width={210}
            height={26}
            priority
          />
          <Image
            className="ro-logo ro-logo--light"
            src="/ui-kit/logos/reliantoutreach-logo-black.svg"
            alt={brand.productName}
            width={210}
            height={26}
            priority
          />
        </Link>
        <label className="ro-search nav-search">
          <Search size={16} />
          <input
            ref={searchRef}
            aria-label="Find a page"
            placeholder="Find a page"
            value={navSearch}
            onChange={(e) => setNavSearch(e.target.value)}
          />
        </label>
        <div className="workspace-card ro-switcher">
          <span className="workspace-avatar ro-avatar ro-avatar--brand">
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
        </div>
        <nav aria-label="Workspace navigation">
          {navGroups.map(
            ({ group, items }) =>
              items.length > 0 && (
                <Fragment key={group}>
                  <div className="ro-nav-group">{group}</div>
                  {items.map(([label, slug, Icon]) => (
                    <Link
                      key={label}
                      href={`${base}${slug ? `/${slug}` : ""}`}
                      onClick={() => {
                        setOpen(false);
                        setNavSearch("");
                      }}
                      className={`ro-nav-item ${current === label ? "active" : ""}`}
                      aria-current={current === label ? "page" : undefined}
                    >
                      <Icon size={19} />
                      {label}
                      {label === "Notifications" &&
                        notificationSummary?.unread > 0 && (
                          <span className="nav-badge count count--accent">
                            {notificationSummary.unread > 99
                              ? "99+"
                              : notificationSummary.unread}
                          </span>
                        )}
                    </Link>
                  ))}
                </Fragment>
              ),
          )}
          {navSearch && !navGroups.some((g) => g.items.length) && (
            <p className="muted small">No matching pages.</p>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help ro-help">
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
            className="profile ro-user"
            onClick={async () => {
              await createAuthClient().signOut();
              for (const key of Object.keys(localStorage))
                if (key.startsWith("outreach-draft:"))
                  localStorage.removeItem(key);
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
      <div className="main-shell ro-main" inert={open || undefined}>
        <header className="topbar ro-topbar">
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
          <div className="topbar-account">
            <Link
              href={`${base}/${admin ? "system" : "notifications"}`}
              className="topbar-alerts"
              aria-label={
                admin
                  ? "System health"
                  : `Notifications${notificationSummary?.unread ? `, ${notificationSummary.unread} unread` : ""}`
              }
            >
              {admin ? <Activity size={20} /> : <Bell size={20} />}
              {!admin && notificationSummary?.unread > 0 && (
                <span className="alert-dot" />
              )}
            </Link>
            <span className="profile-avatar" aria-hidden="true">
              {name.slice(0, 1).toUpperCase()}
            </span>
            <div className="topbar-identity">
              <strong>{name}</strong>
              <small>
                {preview
                  ? "Client preview"
                  : admin
                    ? "Superadmin"
                    : ctx?.company || "Your workspace"}
              </small>
            </div>
          </div>
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
        <main className="page-content ro-content">{children}</main>
        <nav className="mobile-bottom-nav" aria-label="Quick navigation">
          {mobileNav.map(([label, slug, Icon]) => (
            <Link
              key={slug}
              href={`${base}${slug ? `/${slug}` : ""}`}
              className={current === label ? "active" : ""}
              aria-current={current === label ? "page" : undefined}
            >
              <Icon size={22} />
              <span>{slug === "" ? "Home" : label}</span>
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="More navigation"
            aria-expanded={open}
            aria-controls="workspace-navigation"
            className={
              !mobileNav.some(([label]) => label === current) ? "active" : ""
            }
          >
            <Menu size={22} />
            <span>More</span>
          </button>
        </nav>
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
