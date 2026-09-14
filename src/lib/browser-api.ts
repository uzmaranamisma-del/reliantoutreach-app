"use client";
export async function api<T = any>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: data === undefined ? "GET" : "POST",
    headers:
      data === undefined ? undefined : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
    credentials: "same-origin",
    cache: "no-store",
  });
  const body = await response.json();
  if (!response.ok) {
    const fields = Array.isArray(body.fields)
      ? body.fields
          .slice(0, 5)
          .map((f: any) => `${f.path ? `${f.path}: ` : ""}${f.message}`)
          .join(" ")
      : "";
    throw new Error(fields || body.error || "Request failed.");
  }
  return body;
}
