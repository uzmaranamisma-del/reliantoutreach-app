import "dotenv/config";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import mariadb from "mariadb";

// Never writes plaintext SQL to disk. Restores are restricted to an EMPTY drill DB.
const [mode, file] = process.argv.slice(2);
const key = process.env.BACKUP_ENCRYPTION_KEY || "";
if (!/^[a-f0-9]{64}$/i.test(key) || !["create", "restore-test"].includes(mode) || !file) {
  console.error("Usage: node scripts/backup.mjs create|restore-test FILE.robackup; set a separate 64-hex BACKUP_ENCRYPTION_KEY."); process.exit(1);
}
const source = new URL(process.env.DATABASE_URL);
const url = mode === "restore-test" ? new URL(process.env.RESTORE_DATABASE_URL) : source;
if (mode === "restore-test" && (!url.pathname.endsWith("_restore_test") || (url.host === source.host && url.pathname === source.pathname))) throw new Error("Use a separate empty database ending in _restore_test");
const directory = mkdtempSync(join(tmpdir(), "outreach-backup-"));
const optionsFile = join(directory, "client.cnf");
const escape = value => {
  if (/[\r\n\0]/.test(value)) throw new Error("Unsupported credential format");
  return '"' + value.replaceAll("\\", "\\\\").replaceAll('"', '\\"') + '"';
};
try {
  writeFileSync(optionsFile, `[client]\nhost=${escape(url.hostname)}\nport=${Number(url.port || 3306)}\nuser=${escape(decodeURIComponent(url.username))}\npassword=${escape(decodeURIComponent(url.password))}\n${process.env.DATABASE_SSL === "true" ? "ssl-mode=VERIFY_IDENTITY\n" : ""}`, { mode: 0o600 });
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error("Invalid database name");
  if (mode === "create") {
    const dump = spawnSync(process.env.MYSQLDUMP_PATH || "mysqldump", [`--defaults-extra-file=${optionsFile}`, "--single-transaction", "--no-tablespaces", "--set-gtid-purged=OFF", "--hex-blob", database], { maxBuffer: 512 * 1024 * 1024 });
    if (dump.status !== 0) throw new Error("Database export failed. Check database access and MYSQLDUMP_PATH.");
    const nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), nonce);
    const encrypted = Buffer.concat([cipher.update(gzipSync(dump.stdout)), cipher.final()]);
    writeFileSync(resolve(file), Buffer.concat([Buffer.from("ROBACK01"), nonce, cipher.getAuthTag(), encrypted]), { flag: "wx", mode: 0o600 });
    console.log("Encrypted database backup created. Keep its key separately in your password manager.");
  } else {
    const input = readFileSync(resolve(file));
    if (input.subarray(0, 8).toString() !== "ROBACK01") throw new Error("Invalid backup format");
    const decipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), input.subarray(8,20));
    decipher.setAuthTag(input.subarray(20,36));
    const sql = gunzipSync(Buffer.concat([decipher.update(input.subarray(36)), decipher.final()]), { maxOutputLength: 512 * 1024 * 1024 });
    const connection = await mariadb.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database, cachingRsaPublicKey: process.env.DATABASE_RSA_PUBLIC_KEY, ...(process.env.DATABASE_SSL === "true" ? { ssl: { rejectUnauthorized: true } } : {}) });
    try { if ((await connection.query("SHOW TABLES")).length) throw new Error("Restore target must be empty"); } finally { await connection.end(); }
    const restored = spawnSync(process.env.MYSQL_PATH || "mysql", [`--defaults-extra-file=${optionsFile}`, database], { input: sql, maxBuffer: 1024 * 1024 });
    if (restored.status !== 0) throw new Error("Restore failed; inspect the isolated target before retrying");
    console.log("Backup authenticated and restored into the isolated test database. Do not enable its outbound workers.");
  }
} catch (error) {
  console.error(error.message.includes("authenticate") ? "Backup authentication failed; no restore performed." : error.message); process.exitCode = 1;
} finally { rmSync(optionsFile, { force: true }); rmdirSync(directory); }
