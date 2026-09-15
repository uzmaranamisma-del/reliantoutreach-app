import { AppError } from "@/lib/errors";
import { forClient, type ProviderPage } from "@/lib/manyreach/client";

// One provider page per worker claim keeps synchronization resumable and bounded.
export async function syncDataStage(clientId: string, payload: any) {
  payload.stage ??= 0;
  payload.counts ??= {};
  payload.missing ??= [];
  const stage = payload.stage;
  if (!Number.isInteger(stage) || stage < 0 || stage > 5)
    throw new AppError(422, "Invalid sync progress.");
  if (stage === 5) return true;
  const kind = ["campaigns", "prospects", "lists", "senders", "messages"][
    stage
  ];
  const p = await forClient(clientId);
  const query =
    stage === 0
      ? {
          "pageQuery.limit": 100,
          "pageQuery.includeArchived": true,
          "pageQuery.startingAfter": payload.cursor,
        }
      : { limit: 1, ...(stage === 4 ? { type: "Reply" } : {}) };
  const page = await p.request<ProviderPage>(
    `/${kind}`,
    "GET",
    undefined,
    query,
  );
  if (
    !Array.isArray(page.items) ||
    !Number.isSafeInteger(page.pagination?.totalItems) ||
    page.pagination.totalItems < 0
  )
    throw new AppError(
      502,
      "The data sync response was incomplete. Retry synchronization.",
    );
  payload.counts[stage === 4 ? "replies" : kind] = page.pagination.totalItems;
  if (stage === 0) {
    payload.scanned = (payload.scanned || 0) + page.items.length;
    for (const field of [
      "sentCount",
      "replyCount",
      "openCount",
      "clickCount",
      "bounceCount",
      "interestedCount",
    ]) {
      payload.counts[field] ??= 0;
      for (const row of page.items) {
        if (
          typeof row[field] !== "number" ||
          !Number.isFinite(row[field]) ||
          row[field] < 0
        ) {
          if (!payload.missing.includes(field)) payload.missing.push(field);
        } else payload.counts[field] += row[field];
      }
    }
    const next = page.pagination.nextCursor;
    // Some Manyreach responses keep a cursor on the final page. Once the
    // reported total has been scanned, that cursor is no longer actionable.
    if (
      next !== undefined &&
      next !== null &&
      next !== "" &&
      payload.scanned < page.pagination.totalItems
    ) {
      payload.seenCursors ??= [];
      if (!page.items.length || payload.seenCursors.includes(String(next)))
        throw new AppError(
          502,
          "The campaign pages did not advance consistently. Retry synchronization.",
        );
      payload.seenCursors.push(String(next));
      payload.cursor = next;
      return false;
    }
    if (payload.scanned !== page.pagination.totalItems)
      throw new AppError(
        502,
        "Campaigns changed during sync or some pages were missing. Retry synchronization.",
      );
    delete payload.cursor;
    delete payload.seenCursors;
  }
  payload.stage = stage + 1;
  return payload.stage === 5;
}
export function syncValues(payload: any, teamMembers: number) {
  const values = { ...payload.counts, teamMembers };
  for (const field of payload.missing || []) delete values[field];
  return values;
}
