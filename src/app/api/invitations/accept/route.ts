import { endpoint, json, sameOrigin } from "@/lib/errors";
import { identity } from "@/lib/access";
import { acceptInvitation } from "@/server/invitations";
import { rateLimit } from "@/lib/locks";
import { hash } from "@/lib/crypto";
export const POST = endpoint(async (request) => {
  sameOrigin(request);
  const input = await json(request);
  await rateLimit(`invite:${hash(String(input.token || ""))}`, 5, 300);
  let who;
  try {
    who = await identity(request);
  } catch {}
  return acceptInvitation(input, who?.user.id);
});
