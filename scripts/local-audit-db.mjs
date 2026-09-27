import "dotenv/config";
import mariadb from "mariadb";
import { spawnSync } from "node:child_process";
const url = new URL(process.env.DATABASE_URL);
if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("Local audit database only");
const options = { host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), cachingRsaPublicKey: process.env.DATABASE_RSA_PUBLIC_KEY };
const database = "reliantoutreach_audit_test";
const connection = await mariadb.createConnection(options);
await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
if (process.argv.includes("--test")) await connection.query(`DELETE FROM \`${database}\`.RateLimit`);
await connection.end();
url.pathname = `/${database}`;
process.env.DATABASE_URL = url.toString();
process.env.E2E_DATABASE_TESTS = "true";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.SMTP_HOST = "";
process.env.MANYREACH_API_KEY = "";
process.env.VAPID_PRIVATE_KEY = "";
process.env.BOOTSTRAP_PASSWORD = "";
function run(file, args) {
  const result = spawnSync(process.execPath, [file, ...args], { stdio: "inherit", env: process.env });
  if (result.status !== 0) process.exit(result.status || 1);
}
if (process.argv.includes("--serve")) run("node_modules/next/dist/bin/next", ["start", "-p", "3000"]);
else if (process.argv.includes("--test")) { process.env.PLAYWRIGHT_BASE_URL = "http://localhost:3000"; process.env.PLAYWRIGHT_CHANNEL = "chrome"; run("node_modules/@playwright/test/cli.js", ["test"]); }
else if (process.argv.includes("--resolve-local-failed-push")) run("node_modules/prisma/build/index.js", ["migrate", "resolve", "--rolled-back", "20260916010000_push_subscriptions"]);
else run("node_modules/prisma/build/index.js", ["migrate", "deploy"]);
