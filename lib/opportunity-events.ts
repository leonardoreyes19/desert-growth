/**
 * GHL's opportunities API only exposes each deal's current stage, but every
 * create / stage change / status change / delete is logged as an "activity"
 * message in the contact's conversation. This rebuilds each opportunity's full
 * history from those, so we know when it was quoted, won, lost, etc.
 *
 * Plain fetch with an explicit token (no "server-only") so the backfill script
 * can use it too. Costs one call per conversation (~200), so the app reads a
 * stored copy (lib/opportunity-history.ts) instead of calling this per request.
 */

export type OppEvent = {
  /** When it happened (ms). */
  t: number;
  /** Stage after the event ("" if unknown). */
  stage: string;
  /** Status after the event: open / won / lost / abandoned. */
  status: string;
  deleted?: true;
};

/** Opportunity id → its events, oldest first. */
export type OppEventLog = Record<string, OppEvent[]>;

type Activity = {
  type?: string;
  data?: { id?: string; status?: string; stage?: { newStageName?: string } };
};

const BASE_URL = "https://services.leadconnectorhq.com";

export async function fetchOpportunityEvents(token: string, locationId: string): Promise<OppEventLog> {
  const headers = { Authorization: `Bearer ${token}`, Version: "2021-07-28", Accept: "application/json" };

  async function ghl<T>(path: string, params: Record<string, string | number>): Promise<T> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const url = new URL(BASE_URL + path);
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
      // The signal also opts out of Next's fetch memoization when this runs inside the app.
      const res = await fetch(url, { headers, cache: "no-store", signal: new AbortController().signal });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`GHL ${res.status} on ${path}: ${(await res.text()).slice(0, 300)}`);
      return res.json() as Promise<T>;
    }
    throw new Error(`GHL rate limit on ${path}`);
  }

  const conversationIds = new Set<string>();
  let startAfterDate: number | undefined;
  for (let page = 0; page < 50; page++) {
    const params: Record<string, string | number> = { locationId, limit: 100 };
    if (startAfterDate) params.startAfterDate = startAfterDate;
    const data = await ghl<{ conversations: { id: string; sort: number[] | number }[] }>("/conversations/search", params);
    for (const c of data.conversations) conversationIds.add(c.id);
    if (data.conversations.length < 100) break;
    const sort = data.conversations[data.conversations.length - 1].sort;
    startAfterDate = Array.isArray(sort) ? sort[0] : sort;
  }

  const log: OppEventLog = {};
  const ids = [...conversationIds];
  // 5 conversations at a time with a short pause keeps us under GHL's burst limit.
  for (let i = 0; i < ids.length; i += 5) {
    await Promise.all(
      ids.slice(i, i + 5).map(async (id) => {
        let lastMessageId: string | undefined;
        for (let page = 0; page < 20; page++) {
          const params: Record<string, string | number> = { limit: 100 };
          if (lastMessageId) params.lastMessageId = lastMessageId;
          const data = await ghl<{
            messages: { messages: { dateAdded: string; activity?: Activity }[]; nextPage: boolean; lastMessageId: string };
          }>(`/conversations/${id}/messages`, params);
          for (const m of data.messages.messages) {
            const a = m.activity;
            if (!a?.type?.startsWith("opportunity_") || !a.data?.id) continue;
            const event: OppEvent = { t: new Date(m.dateAdded).getTime(), stage: a.data.stage?.newStageName ?? "", status: a.data.status ?? "" };
            if (a.type === "opportunity_deleted") event.deleted = true;
            (log[a.data.id] ??= []).push(event);
          }
          if (!data.messages.nextPage || data.messages.messages.length === 0) break;
          lastMessageId = data.messages.lastMessageId;
        }
      })
    );
    await new Promise((r) => setTimeout(r, 500));
  }
  for (const events of Object.values(log)) events.sort((a, b) => a.t - b.t);
  return log;
}
