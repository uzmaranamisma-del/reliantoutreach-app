import { z } from "zod";
import { identity } from "@/lib/access";
import { db } from "@/lib/db";
import { endpoint, json, sameOrigin } from "@/lib/errors";

export const GET = endpoint(async (request) => {
  const { user } = await identity(request);
  return { themePreference: user.themePreference };
});
export const POST = endpoint(async (request) => {
  sameOrigin(request);
  const { user } = await identity(request);
  const data = z
    .object({ themePreference: z.enum(["dark", "light", "system"]) })
    .strict()
    .parse(await json(request, 1024));
  await db.user.update({ where: { id: user.id }, data });
  return data;
});
