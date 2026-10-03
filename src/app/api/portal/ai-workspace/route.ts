import { tenant } from "@/lib/access";
import { endpoint, json, sameOrigin } from "@/lib/errors";
import {
  canEditAiProfile,
  readAiWorkspace,
  saveAiWorkspace,
} from "@/server/ai-workspace";

export const GET = endpoint(async (request) => {
  const ctx = await tenant(request);
  return readAiWorkspace(ctx.client.id, canEditAiProfile(ctx.role));
});
export const POST = endpoint(async (request) => {
  sameOrigin(request);
  return saveAiWorkspace(request, await json(request));
});
