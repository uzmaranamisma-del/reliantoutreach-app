import { db } from "@/lib/db";
import { forClient, type ProviderPage } from "@/lib/manyreach/client";
import { withLease } from "@/lib/locks";

export function sumSentSeries(stats: { sentSeries?: { count?: unknown } }) {
  const values = stats.sentSeries?.count;
  if (!Array.isArray(values) || values.some(v => typeof v !== "number" || !Number.isFinite(v) || v < 0)) throw new Error("Monthly usage unavailable");
  return values.reduce((sum, value) => sum + value, 0);
}
// Campaign statistics are an observed allowance, not an atomic provider cutoff.
// One page OR one campaign per workspace/run keeps expensive accounts resumable.
export async function collectMonthlyUsage() {
  return withLease("usage:monthly", async () => {
    const month = new Date().toISOString().slice(0, 7);
    const clients = await db.client.findMany({ where: { status: "ACTIVE", mapping: { isNot: null } }, select: { id: true } });
    const rotation = await db.appSetting.findUnique({ where: { key: "usage.rotation" } });
    const after = typeof rotation?.value === "string" ? rotation.value : "";
    const selected = clients.filter(c => c.id > after).sort((a, b) => a.id.localeCompare(b.id)).slice(0, 3);
    for (const client of selected) {
      const key = `usage.scan:${client.id}`;
      const record = await db.appSetting.findUnique({ where: { key } });
      const previous = record?.value as any;
      const state = previous?.month === month ? previous : { month, cursor: null, campaigns: [], total: 0, startedAt: new Date().toISOString(), scanned: 0 };
      if (state.completedAt && Date.now() - Date.parse(state.completedAt) < 30 * 60000) continue;
      if (state.completedAt) Object.assign(state, { cursor: null, campaigns: [], total: 0, startedAt: new Date().toISOString(), scanned: 0, completedAt: null });
      try {
        const p = await forClient(client.id);
        if (!state.campaigns.length) {
          const page = await p.request<ProviderPage>("/campaigns", "GET", undefined, { "pageQuery.limit": 100, "pageQuery.includeArchived": true, "pageQuery.startingAfter": state.cursor });
          if (!Array.isArray(page.items) || !Number.isSafeInteger(page.pagination?.totalItems)) throw new Error();
          state.scanned += page.items.length;
          state.campaigns = page.items.map(c => String(c.campaignId));
          const next = page.pagination.nextCursor;
          if (state.scanned < page.pagination.totalItems && (!next || String(next) === state.cursor)) throw new Error();
          state.cursor = state.scanned < page.pagination.totalItems ? String(next) : null;
        } else {
          const stats = await p.request(`/campaigns/${state.campaigns[0]}/stats`, "GET", undefined, { dateStart: `${month}-01`, dateEnd: state.startedAt });
          state.total += sumSentSeries(stats);
          state.campaigns.shift();
        }
        if (!state.campaigns.length && !state.cursor) {
          state.completedAt = new Date().toISOString();
          const values = { monthlyEmails: state.total, month, through: state.startedAt, basis: "campaign statistics; manual replies may not be included" };
          await db.usageSnapshot.upsert({ where: { clientId_period: { clientId: client.id, period: `month:${month}` } }, create: { clientId: client.id, period: `month:${month}`, values }, update: { values, capturedAt: new Date() } });
        }
        state.error = null;
        await db.appSetting.upsert({ where: { key }, create: { key, value: state }, update: { value: state } });
      } catch {
        // Keep the last good cursor/total; no partial count is published.
        const value = { ...(previous?.month === month ? previous : { month, cursor: null, campaigns: [], total: 0, scanned: 0, startedAt: new Date().toISOString() }), error: "Monthly usage could not refresh; retrying." };
        await db.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
      }
    }
    await db.appSetting.upsert({ where: { key: "usage.rotation" }, create: { key: "usage.rotation", value: selected.at(-1)?.id || "" }, update: { value: selected.at(-1)?.id || "" } });
    return { workspaces: selected.length };
  }, 180);
}
