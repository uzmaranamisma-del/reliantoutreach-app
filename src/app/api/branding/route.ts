import { endpoint } from "@/lib/errors";
import { getBranding } from "@/server/settings";
export const GET = endpoint(async () => getBranding());
