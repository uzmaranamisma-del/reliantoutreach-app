import { getAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { db } from "@/lib/db";
export async function GET(request: Request) {
  try {
    const signingOut = request.method === "POST" && new URL(request.url).pathname.endsWith("/sign-out");
    const session = signingOut ? await getAuth().api.getSession({ headers: request.headers }) : null;
    const response = await getAuth().handler(request);
    if (response.ok && session) await db.pushSubscription.deleteMany({ where: { sessionId: session.session.id } });
    return response;
  } catch (e) {
    return errorResponse(e);
  }
}
export const POST = GET;
