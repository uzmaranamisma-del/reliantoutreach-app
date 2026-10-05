import { androidRelease } from "@/lib/mobile-release";
export function GET() {
  return Response.json(
    { android: androidRelease, ios: null },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
