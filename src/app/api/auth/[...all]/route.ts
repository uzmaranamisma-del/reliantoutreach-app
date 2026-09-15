import { getAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
export async function GET(request: Request) {
  try {
    return await getAuth().handler(request);
  } catch (e) {
    return errorResponse(e);
  }
}
export const POST = GET;
