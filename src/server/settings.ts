import { db } from "@/lib/db";
import { brandingInput, defaultBranding } from "@/lib/branding";
export async function getBranding() {
  const row = await db.appSetting.findUnique({ where: { key: "branding" } });
  const parsed = brandingInput.safeParse(row?.value);
  return parsed.success ? parsed.data : defaultBranding;
}
export async function saveBranding(actorId: string, input: unknown) {
  const value = brandingInput.parse(input);
  await db.$transaction(async (tx) => {
    await tx.appSetting.upsert({
      where: { key: "branding" },
      create: { key: "branding", value },
      update: { value },
    });
    await tx.auditLog.create({
      data: { actorId, action: "settings.branding-updated" },
    });
  });
  return value;
}
