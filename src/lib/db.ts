import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";
const globalDb = globalThis as unknown as { db?: PrismaClient };
function createDb() {
  const url = new URL(
    process.env.DATABASE_URL ||
      "mysql://unconfigured:unconfigured@localhost:3306/unconfigured",
  );
  return new PrismaClient({
    adapter: new PrismaMariaDb({
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
      connectionLimit: 5,
      connectTimeout: 5000,
      acquireTimeout: 10000,
      ...(process.env.DATABASE_SSL === "true"
        ? { ssl: { rejectUnauthorized: true } }
        : {}),
    }),
  });
}
export const db = globalDb.db ?? createDb();
globalDb.db = db;
