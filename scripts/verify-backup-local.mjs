import "dotenv/config";
import { readFileSync, unlinkSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import mariadb from "mariadb";
const source = new URL(process.env.DATABASE_URL);
if (source.hostname !== "127.0.0.1") throw new Error("Local recovery drill only");
const privateFile = resolve("../../work/local-mysql/private.json");
const rootPassword = JSON.parse(readFileSync(privateFile, "utf8")).rootPassword;
const targetName = `outreach_${Date.now()}_restore_test`;
const root = await mariadb.createConnection({ host: source.hostname, port: Number(source.port), user: "root", password: rootPassword, cachingRsaPublicKey: process.env.DATABASE_RSA_PUBLIC_KEY });
await root.query(`CREATE DATABASE \`${targetName}\``);
await root.query(`GRANT ALL PRIVILEGES ON \`${targetName}\`.* TO ?@'localhost'`, [decodeURIComponent(source.username)]);
source.pathname = "/reliantoutreach_audit_test";
const target = new URL(source); target.pathname = `/${targetName}`;
const file = resolve(`../recovery-drill-${Date.now()}.robackup`);
const bin = resolve("../../work/local-mysql/mysql-26.7.0-winx64/bin");
const env = { ...process.env, DATABASE_URL: source.toString(), RESTORE_DATABASE_URL: target.toString(), BACKUP_ENCRYPTION_KEY: randomBytes(32).toString("hex"), MYSQLDUMP_PATH: `${bin}/mysqldump.exe`, MYSQL_PATH: `${bin}/mysql.exe` };
try {
  for (const mode of ["create", "restore-test"]) {
    const run = spawnSync(process.execPath, ["scripts/backup.mjs", mode, file], { env, stdio: "inherit" });
    if (run.status) throw new Error("Local restore drill failed");
  }
  const rows = await root.query(`SELECT COUNT(*) AS n FROM \`${targetName}\`._prisma_migrations WHERE finished_at IS NOT NULL`);
  if (Number(rows[0].n) !== 10) throw new Error("Restored migration history mismatch");
  console.log("Verified: encrypted backup restored all 10 migration records into an isolated database.");
} finally {
  // Only the exact disposable database created above is removed.
  await root.query(`DROP DATABASE \`${targetName}\``);
  await root.end();
  try { unlinkSync(file); } catch { /* No backup was created. */ }
}
