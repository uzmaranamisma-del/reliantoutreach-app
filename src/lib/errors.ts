import { ZodError } from "zod";
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "REQUEST_FAILED",
  ) {
    super(message);
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof ZodError)
    return Response.json(
      {
        error: "Review the highlighted fields and try again.",
        fields: error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 422 },
    );
  if (error instanceof AppError)
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  console.error(
    "Request failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return Response.json(
    { error: "We could not complete your request. Please try again." },
    { status: 500 },
  );
}
export function endpoint(
  fn: (request: Request, context: any) => Promise<unknown>,
) {
  return async (r: Request, c: any) => {
    try {
      const result = await fn(r, c);
      return result instanceof Response
        ? result
        : Response.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      return errorResponse(e);
    }
  };
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ).origin;
  if (origin !== allowed)
    throw new AppError(403, "Request origin is not allowed.");
}
export async function json(request: Request, max = 128_000) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new AppError(415, "JSON is required.");
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, "Request body is missing.");
  let body = "",
    bytes = 0;
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > max) {
      await reader.cancel();
      throw new AppError(413, "Request is too large.");
    }
    body += decoder.decode(value, { stream: true });
  }
  try {
    return JSON.parse(body + decoder.decode());
  } catch {
    throw new AppError(400, "Invalid JSON.");
  }
}
