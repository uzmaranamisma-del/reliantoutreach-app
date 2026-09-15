import { spawnSync } from "node:child_process";

const runner = process.platform === "win32" ? "npx.cmd" : "npx";

function run(args) {
  const result = spawnSync(runner, ["--no-install", ...args], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(["prisma", "migrate", "deploy"]);
run(["prisma", "generate"]);

if (process.env.BOOTSTRAP_EMAIL && process.env.BOOTSTRAP_PASSWORD && process.env.BOOTSTRAP_NAME) {
  run(["tsx", "scripts/bootstrap.ts"]);
}

run(["next", "build"]);
