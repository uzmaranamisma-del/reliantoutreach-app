import { z } from "zod";
import { db } from "./db";
import { AppError } from "./errors";
export async function once<T>(
  clientId: string,
  key: string,
  fn: () => Promise<T>,
) {
  z.uuid().parse(key);
  try {
    await db.mutationReceipt.create({
      data: { clientId, key, status: "pending" },
    });
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "P2002"
    )
      throw error;
    throw new AppError(
      409,
      "This action was already submitted. Refresh to check its result.",
    );
  }
  try {
    const result = await fn();
    await db.mutationReceipt.update({
      where: { clientId_key: { clientId, key } },
      data: { status: "completed" },
    });
    return result;
  } catch (e) {
    await db.mutationReceipt.update({
      where: { clientId_key: { clientId, key } },
      data: { status: "review" },
    });
    throw e;
  }
}
