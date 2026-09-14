import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { rateLimit, withProviderSlot } from "@/lib/locks";
import { AppError } from "@/lib/errors";
export type ProviderRecord = Record<string, any>;
export type ProviderPage = {
  items: ProviderRecord[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalItems: number;
    nextCursor?: number | string | null;
  };
};
export class ProviderError extends AppError {
  constructor(
    public providerStatus: number,
    public ambiguous = false,
  ) {
    super(
      providerStatus === 429 ? 429 : 502,
      ambiguous
        ? "The result could not be confirmed. Refresh before trying this action again."
        : "Your outreach service could not complete this request. Please try again shortly.",
      "OUTREACH_UNAVAILABLE",
    );
  }
}
export async function providerRequest<T = ProviderRecord>(
  key: string,
  bucket: string,
  path: string,
  method = "GET",
  body?: unknown,
  query: Record<string, unknown> = {},
  clientId?: string,
): Promise<T> {
  const base = new URL(
    process.env.MANYREACH_API_BASE_URL || "https://api.manyreach.com/api/v2",
  );
  if (
    base.origin !== "https://api.manyreach.com" ||
    base.pathname.replace(/\/$/, "") !== "/api/v2"
  )
    throw new AppError(503, "Outreach connection is not configured.");
  if (!/^\/[a-z]+(?:\/[a-zA-Z0-9_.@-]+)*$/.test(path))
    throw new AppError(400, "Invalid resource.");
  const url = new URL(base.toString().replace(/\/$/, "") + path);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== null)
      url.searchParams.set(k, String(v));
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    await rateLimit(`provider:${bucket}`, 50);
    const started = Date.now();
    let response: Response;
    let responseText: string;
    try {
      const received = await withProviderSlot(bucket, async () => {
        const response = await fetch(url, {
          method,
          headers: {
            "X-API-Key": key,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(12000),
          cache: "no-store",
          redirect: "error",
        });
        return { response, text: await response.text() };
      });
      response = received.response;
      responseText = received.text;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new ProviderError(0, method !== "GET");
    }
    await db.apiLog.create({
      data: {
        clientId,
        operation: `${method} ${path.replace(/\/[0-9]+/g, "/:id")}`,
        status: response.status,
        durationMs: Date.now() - started,
        requestId: randomUUID(),
      },
    });
    if (response.status === 429) {
      const wait = Math.max(
        1,
        Number(response.headers.get("retry-after")) || 60,
      );
      await db.requestBucket.update({
        where: { key: `provider:${bucket}` },
        data: { blockedUntil: new Date(Date.now() + wait * 1000) },
      });
      throw new ProviderError(429);
    }
    if (!response.ok) {
      if (method === "GET" && response.status >= 500 && attempt < 2) {
        await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
        continue;
      }
      throw new ProviderError(
        response.status,
        method !== "GET" && response.status >= 500,
      );
    }
    if (response.status === 204) return {} as T;
    const text = responseText;
    if (!text) return {} as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ProviderError(response.status, method !== "GET");
    }
  }
  throw new ProviderError(503);
}
export async function forClient(clientId: string) {
  const mapping = await db.manyreachClientspace.findUnique({
    where: { clientId },
  });
  if (!mapping)
    throw new AppError(
      503,
      "Your outreach connection needs administrator attention.",
    );
  const key = decrypt(mapping.encryptedApiKey);
  return {
    mapping,
    request: <T = ProviderRecord>(
      path: string,
      method = "GET",
      body?: unknown,
      query: Record<string, unknown> = {},
    ) =>
      providerRequest<T>(
        key,
        `clientspace:${mapping.providerId}`,
        path,
        method,
        body,
        query,
        clientId,
      ),
  };
}
export function agencyRequest<T = ProviderRecord>(
  path: string,
  method = "GET",
  body?: unknown,
  query: Record<string, unknown> = {},
) {
  if (!process.env.MANYREACH_API_KEY)
    throw new AppError(503, "Agency connection is not configured.");
  return providerRequest<T>(
    process.env.MANYREACH_API_KEY,
    "agency",
    path,
    method,
    body,
    query,
  );
}
