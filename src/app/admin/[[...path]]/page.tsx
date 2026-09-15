import { redirect } from "next/navigation";
import { identity } from "@/lib/access";
import { Shell } from "@/components/shell";
import { AdminPortal } from "@/features/admin";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  let who;
  try {
    who = await identity();
  } catch {
    redirect("/login");
  }
  if (!who.user.superadmin) redirect("/app");
  return (
    <Shell admin name={who.user.name}>
      <AdminPortal path={(await params).path || []} />
    </Shell>
  );
}
