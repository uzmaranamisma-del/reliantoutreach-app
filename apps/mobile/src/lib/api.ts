import { storage } from "./storage";
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || "https://app.reliantoutreach.com"
).replace(/\/$/, "");
if (!API_URL.startsWith("https://") && !__DEV__)
  throw new Error("The production API must use HTTPS.");
let token: string | null = null;
let onExpired: (() => void) | undefined;
export const sessionToken = {
  load: async () => {
    token = await storage.get("auth.token");
    return token;
  },
  set: async (value: string | null) => {
    token = value;
    if (value) await storage.set("auth.token", value);
    else await storage.remove("auth.token");
  },
  exists: () => !!token,
  onExpired: (fn?: () => void) => {
    onExpired = fn;
  },
};
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  data?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  if (!path.startsWith("/api/")) throw new Error("Invalid API path");
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 25000);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: data === undefined ? "GET" : "POST",
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        Origin: new URL(API_URL).origin,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && token && !path.includes("/sign-in/"))
        onExpired?.();
      throw new ApiError(
        body.error?.message ||
          body.error ||
          body.message ||
          "Unable to complete this request.",
        response.status,
      );
    }
    const refreshed = response.headers.get("set-auth-token");
    if (refreshed) await sessionToken.set(refreshed);
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "Connection interrupted. Check your internet connection and try again.",
      0,
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
