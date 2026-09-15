import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const specPath = process.argv[2];
if (!specPath) {
  throw new Error(
    "Pass the Manyreach Swagger file: npm run verify:manyreach -- C:\\path\\to\\v2.json",
  );
}

const root = resolve(import.meta.dirname, "..");
const spec = JSON.parse(await readFile(resolve(specPath), "utf8"));
const expected = new Set(
  (await readFile(resolve(root, "src/lib/manyreach/verified-endpoints.txt"), "utf8"))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean),
);
const methods = new Set(["get", "post", "put", "patch", "delete"]);
const actual = new Set();
for (const [path, operations] of Object.entries(spec.paths || {})) {
  for (const method of Object.keys(operations || {})) {
    if (methods.has(method)) actual.add(`${method.toUpperCase()} ${path}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function definition(name, fields) {
  const properties = spec.definitions?.[name]?.properties;
  assert(properties, `Missing definition: ${name}`);
  for (const field of fields)
    assert(field in properties, `${name} is missing ${field}`);
}

assert(spec.swagger === "2.0", "Expected Swagger 2.0");
assert(spec.host === "api.manyreach.com", "Unexpected Manyreach API host");
assert(spec.schemes?.includes("https"), "Manyreach API must support HTTPS");
const apiKey = spec.securityDefinitions?.["X-API-Key"];
assert(
  apiKey?.type === "apiKey" &&
    apiKey?.name === "X-API-Key" &&
    apiKey?.in === "header",
  "Expected X-API-Key header authentication",
);

const missing = [...expected].filter((entry) => !actual.has(entry));
const extra = [...actual].filter((entry) => !expected.has(entry));
assert(!missing.length, `Missing endpoints: ${missing.join(", ")}`);
assert(!extra.length, `Unreviewed endpoints: ${extra.join(", ")}`);

definition("AccountContext", ["keyType", "id", "title"]);
definition("Clientspace", ["clientspaceId", "title", "apiKey"]);
definition("Workspace", ["workspaceId", "title", "apiKey"]);
definition("PaginationInteger", [
  "currentPage",
  "pageSize",
  "totalItems",
  "nextCursor",
]);
definition("Campaign", [
  "campaignId",
  "sentCount",
  "replyCount",
  "openCount",
  "clickCount",
  "bounceCount",
  "interestedCount",
]);
for (const page of [
  "ClientspacePage",
  "WorkspacePage",
  "CampaignPage",
  "ProspectPage",
  "ListPage",
  "SenderPage",
  "MessagePage",
])
  definition(page, ["items", "pagination"]);

console.log(
  `Manyreach API contract verified: ${actual.size} endpoints, Swagger ${spec.info?.version || "unknown"}.`,
);
