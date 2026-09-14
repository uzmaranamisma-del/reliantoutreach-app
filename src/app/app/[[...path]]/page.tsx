import { redirect } from "next/navigation";
import { identity, tenant } from "@/lib/access";
import { Shell } from "@/components/shell";
import { Portal } from "@/features/portal";
import { AppError } from "@/lib/errors";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  if (!process.env.DATABASE_URL || !process.env.AUTH_SECRET) redirect("/login");
  let who;
  try {
    who = await identity();
  } catch {
    redirect("/login");
  }
  if (who.user.superadmin && !who.session.impersonatingClientId)
    redirect("/admin");
  try {
    await tenant();
  } catch (e) {
    if (e instanceof AppError)
      return (
        <main className="standalone">
          <h1>Workspace unavailable</h1>
          <p>{e.message}</p>
        </main>
      );
    throw e;
  }
  return (
    <Shell name={who.user.name}>
      <Portal path={(await params).path || []} />
    </Shell>
  );
}
