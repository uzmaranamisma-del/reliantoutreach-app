import { z } from "zod";
import { db } from "@/lib/db";
import { permissions, limitKeys } from "@/lib/permissions";
import { agencyRequest, providerRequest } from "@/lib/manyreach/client";
import { encrypt } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { createInvitation } from "./invitations";
import { withLease } from "@/lib/locks";
export const packageInput = z
  .object({
    name: z.string().min(1).max(100),
    description: z.string().max(2000),
    price: z.coerce.number().min(0).max(1000000),
    billingLabel: z.string().min(1).max(100),
    active: z.boolean().default(true),
    displayOrder: z.coerce.number().int().min(0).default(0),
    features: z
      .array(z.object({ key: z.enum(permissions), enabled: z.boolean() }))
      .max(50),
    limits: z
      .array(
        z.object({
          key: z.enum(limitKeys),
          value: z.number().int().min(-1).max(2147483647),
        }),
      )
      .max(10),
  })
  .superRefine((v, c) => {
    if (
      new Set(v.features.map((f) => f.key)).size !== v.features.length ||
      new Set(v.limits.map((f) => f.key)).size !== v.limits.length
    )
      c.addIssue({ code: "custom", message: "Duplicate feature or limit." });
  });
export async function savePackage(
  actorId: string,
  input: unknown,
  id?: string,
) {
  const data = packageInput.parse(input);
  const { features, limits, ...fields } = data;
  return db.$transaction(async (tx) => {
    const item = id
      ? await tx.package.update({
          where: { id },
          data: {
            ...fields,
            features: { deleteMany: {}, create: features },
            limits: { deleteMany: {}, create: limits },
          },
        })
      : await tx.package.create({
          data: {
            ...fields,
            features: { create: features },
            limits: { create: limits },
          },
        });
    await tx.auditLog.create({
      data: {
        actorId,
        action: id ? "package.updated" : "package.created",
        resourceId: item.id,
      },
    });
    return { id: item.id };
  });
}
export const clientInput = z.object({
  company: z.string().min(1).max(150),
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100),
  email: z.email().transform((v) => v.toLowerCase()),
  phone: z.string().max(50).optional(),
  website: z.union([z.url(), z.literal("")]).optional(),
  industry: z.string().max(100).optional(),
  country: z.string().min(2).max(100),
  timezone: z
    .string()
    .max(64)
    .refine((v) => {
      try {
        Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, "Invalid timezone"),
  packageId: z.string().min(1),
  connection: z.enum(["existing", "new"]),
  clientspaceId: z.number().int().positive().optional(),
  sendNow: z.boolean().default(true),
});
export async function createClient(actorId: string, input: unknown) {
  const data = clientInput.parse(input);
  if (
    !(await db.package.findFirst({
      where: { id: data.packageId, active: true },
    }))
  )
    throw new AppError(422, "Choose an active package.");
  return withLease("admin:create-client", async () => {
    const space =
      data.connection === "new"
        ? await agencyRequest("/clientspaces", "POST", {
            title: data.company,
            separateCredits: true,
            autoAllocate: false,
            creditAmount: 0,
          })
        : await agencyRequest(
            `/clientspaces/${z.number().int().positive().parse(data.clientspaceId)}`,
          );
    if (!space.apiKey || !Number.isInteger(space.clientspaceId))
      throw new AppError(502, "Clientspace credentials could not be verified.");
    if (
      await db.manyreachClientspace.findUnique({
        where: { providerId: space.clientspaceId },
      })
    )
      throw new AppError(409, "This clientspace is already assigned.");
    const account = await providerRequest(
      space.apiKey,
      `clientspace:${space.clientspaceId}`,
      "/account",
    );
    if (
      account.id !== space.clientspaceId ||
      String(account.keyType).toLowerCase() !== "clientspace"
    )
      throw new AppError(
        502,
        "The connection did not resolve to an isolated clientspace.",
      );
    const { sendNow } = data;
    const fields = clientInput
      .omit({ connection: true, clientspaceId: true, sendNow: true })
      .parse(data);
    const client = await db.client.create({
      data: {
        ...fields,
        mapping: {
          create: {
            providerId: space.clientspaceId,
            encryptedApiKey: encrypt(space.apiKey),
          },
        },
      },
    });
    await db.auditLog.create({
      data: { actorId, clientId: client.id, action: "client.created" },
    });
    // Client persists if invitation fails so admins can safely retry without creating another provider space.
    try {
      await createInvitation(client.id, actorId, {
        email: client.email,
        name: `${client.firstName} ${client.lastName}`.trim(),
        role: "CLIENT_OWNER",
        sendNow,
      });
    } catch {
      throw new AppError(
        409,
        `Client was created. Open Clients and send its owner invitation. Reference: ${client.id}`,
      );
    }
    return { id: client.id };
  });
}
