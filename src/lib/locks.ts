import { randomUUID } from "node:crypto";
import { db } from "./db";
import { AppError } from "./errors";
export async function withLease<T>(
  key: string,
  fn: () => Promise<T>,
  seconds = 120,
): Promise<T> {
  const now = new Date(),
    token = randomUUID();
  try {
    await db.lease.create({
      data: { key, token, expiresAt: new Date(now.getTime() + seconds * 1000) },
    });
  } catch {
    const claimed = await db.lease.updateMany({
      where: { key, expiresAt: { lt: now } },
      data: { token, expiresAt: new Date(now.getTime() + seconds * 1000) },
    });
    if (!claimed.count)
      throw new AppError(
        409,
        "Another operation is in progress. Please try again shortly.",
      );
  }
  try {
    return await fn();
  } finally {
    await db.lease.deleteMany({ where: { key, token } });
  }
}
export async function rateLimit(key: string, max: number, windowSeconds = 60) {
  await withLease(
    `bucket:${key}`,
    async () => {
      const now = new Date(),
        old = await db.requestBucket.findUnique({ where: { key } });
      if (old?.blockedUntil && old.blockedUntil > now)
        throw new AppError(429, "Please wait before trying again.");
      if (
        !old ||
        now.getTime() - old.windowAt.getTime() >= windowSeconds * 1000
      ) {
        await db.requestBucket.upsert({
          where: { key },
          create: { key, count: 1, windowAt: now },
          update: { count: 1, windowAt: now },
        });
        return;
      }
      if (old.count >= max)
        throw new AppError(429, "Please wait before trying again.");
      await db.requestBucket.update({
        where: { key },
        data: { count: { increment: 1 } },
      });
    },
    15,
  );
}
export async function withProviderSlot<T>(
  bucket: string,
  fn: () => Promise<T>,
) {
  const token = randomUUID(),
    now = new Date();
  for (let slot = 0; slot < 3; slot++) {
    const key = `provider-flight:${bucket}:${slot}`,
      expiresAt = new Date(now.getTime() + 30000);
    let claimed = false;
    try {
      await db.lease.create({ data: { key, token, expiresAt } });
      claimed = true;
    } catch {
      const result = await db.lease.updateMany({
        where: { key, expiresAt: { lt: now } },
        data: { token, expiresAt },
      });
      claimed = !!result.count;
    }
    if (claimed) {
      try {
        return await fn();
      } finally {
        await db.lease.deleteMany({ where: { key, token } });
      }
    }
  }
  throw new AppError(
    429,
    "Your workspace is handling other requests. Please try again shortly.",
  );
}
