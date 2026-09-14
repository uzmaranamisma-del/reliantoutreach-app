"use client";
import { ClientDetail } from "./admin/client";
import { Clients } from "./admin/clients";
import { Overview } from "./admin/overview";
import { Packages } from "./admin/packages";
import { AdminRecords } from "./admin/records";
import { System } from "./admin/system";
import { AdminSettings } from "./admin/settings";
export function AdminPortal({ path }: { path: string[] }) {
  const section = path[0] || "overview";
  if (section === "overview") return <Overview />;
  if (section === "packages") return <Packages />;
  if (section === "clients" && path[1]) return <ClientDetail id={path[1]} />;
  if (section === "clients") return <Clients />;
  if (section === "system") return <System />;
  if (section === "settings") return <AdminSettings />;
  return <AdminRecords kind={section} />;
}
