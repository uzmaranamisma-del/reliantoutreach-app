import "dotenv/config";
import { db } from "../src/lib/db";
import {
  publishedPackages,
  approvedTechnicalLimits,
} from "../src/lib/package-catalog";
import { permissions } from "../src/lib/permissions";
async function main() {
  const actor = await db.user.findFirst({
    where: { superadmin: true, disabled: false },
  });
  if (!actor)
    throw new Error("Create the first Superadmin before importing packages.");
  for (const item of publishedPackages) {
    if (await db.package.findFirst({ where: { name: item.name } })) {
      console.log(`${item.name}: already present; unchanged`);
      continue;
    }
    const { monthlyEmails, ...data } = item;
    await db.$transaction(async (tx) => {
      const p = await tx.package.create({
        data: {
          ...data,
          features: {
            create: permissions.map((key) => ({
              key,
              enabled: item.serviceType === "EMAIL",
            })),
          },
          limits: {
            create: [
              { key: "monthlyEmails", value: monthlyEmails },
              ...(item.serviceType === "EMAIL" ? approvedTechnicalLimits : []),
            ],
          },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "package.imported_from_website",
          resourceId: p.id,
          metadata: {
            source: item.sourceUrl,
            verifiedAt: "2026-09-14",
            draft: !item.active,
          },
        },
      });
    });
    console.log(`${item.name}: created (${item.active ? "active" : "draft"})`);
  }
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
