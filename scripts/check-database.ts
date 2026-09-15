import "dotenv/config";
import { db } from "../src/lib/db";

async function main() {
  try {
    await db.$queryRaw`SELECT 1`;
    console.log("Database connection verified.");
  } catch {
    console.error(
      "Database connection failed. Check the database service and authentication configuration.",
    );
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
void main();
