import "dotenv/config";
import { db } from "../src/lib/db";
import { approvedTechnicalLimits } from "../src/lib/package-catalog";
async function main() {
  const actor = await db.user.findFirst({
    where: { superadmin: true, disabled: false },
  });
  if (!actor) throw new Error("Create a Superadmin first.");
  for (const name of ["Launch", "Growth", "Scale"]) {
    const pkg = await db.package.findFirst({
      where: { name, serviceType: "EMAIL" },
    });
    if (!pkg) throw new Error(`Missing package: ${name}`);
    await db.$transaction(async (tx) => {
      for (const limit of approvedTechnicalLimits)
        await tx.packageLimit.upsert({
          where: { packageId_key: { packageId: pkg.id, key: limit.key } },
          create: { packageId: pkg.id, ...limit },
          update: { value: limit.value },
        });
      await tx.package.update({
        where: { id: pkg.id },
        data: { active: true, requiresLimitReview: false },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "package.owner-approved-unlimited-technical-limits",
          resourceId: pkg.id,
          metadata: {
            approvedAt: "2026-09-15",
            monthlyEmailCapacityUnchanged: true,
          },
        },
      });
    });
    console.log(
      `${name}: active, technical limits unlimited; monthly email capacity unchanged`,
    );
  }
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
