import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { db } from "../src/lib/db";
async function main() {
  const email = z.email().parse(process.env.BOOTSTRAP_EMAIL).toLowerCase();
  const password = z
    .string()
    .min(16)
    .max(128)
    .parse(process.env.BOOTSTRAP_PASSWORD);
  const name = z.string().min(1).parse(process.env.BOOTSTRAP_NAME);
  const hashed = await hashPassword(password);
  await db.$transaction(async (tx) => {
    // The unique setting prevents concurrent bootstrap invocations, including after an admin is disabled.
    await tx.appSetting.create({
      data: { key: "bootstrap.completed", value: new Date().toISOString() },
    });
    if (await tx.user.count({ where: { superadmin: true } }))
      throw new Error("A Superadmin already exists.");
    const id = randomUUID();
    await tx.user.create({
      data: {
        id,
        email,
        name,
        superadmin: true,
        emailVerified: true,
        accounts: {
          create: {
            id: randomUUID(),
            providerId: "credential",
            accountId: id,
            password: hashed,
          },
        },
      },
    });
    await tx.auditLog.create({
      data: { actorId: id, action: "bootstrap.completed" },
    });
  });
  console.log(
    "Superadmin created. Remove BOOTSTRAP_PASSWORD, BOOTSTRAP_EMAIL and BOOTSTRAP_NAME from the environment.",
  );
}
main()
  .catch(() => {
    console.error(
      "Bootstrap failed. Check configuration; bootstrap is allowed only once.",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
