"use client";
import { Empty } from "@/components/data";
import { Analytics } from "./portal/analytics";
import { CampaignDetail } from "./portal/campaign";
import { Dashboard } from "./portal/dashboard";
import { Inbox } from "./portal/inbox";
import { Resources } from "./portal/resources";
import { Settings, Team, Usage } from "./portal/workspace";
export { useLive } from "./portal/hooks";
export function Portal({ path }: { path: string[] }) {
  const section = path[0] || "dashboard";
  if (section === "dashboard") return <Dashboard />;
  if (section === "campaigns" && path[1])
    return <CampaignDetail id={path[1]} />;
  if (["campaigns", "prospects", "lists", "senders"].includes(section))
    return <Resources key={section} kind={section} />;
  if (section === "inbox") return <Inbox />;
  if (section === "analytics") return <Analytics />;
  if (section === "usage") return <Usage />;
  if (section === "team") return <Team />;
  if (section === "settings") return <Settings />;
  return <Empty title="Page not found" />;
}
