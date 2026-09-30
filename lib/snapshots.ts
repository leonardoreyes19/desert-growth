import "server-only";
import { get, put } from "@vercel/blob";
import { hermosilloDate, startOfMonth, startOfWeek, type PipelineSnapshot } from "./metrics";

/**
 * GHL only knows each lead's current stage, so to compare the pipeline with
 * last week / last month we keep our own history in a private Vercel Blob
 * store: one JSON file per week (named by its Monday) and one per month, each
 * overwritten with the latest state seen during that period. Once a period
 * ends, its file holds how the pipeline stood at its close.
 */

export type StoredSnapshot = PipelineSnapshot & { recordedAt: string };

export type PipelineHistory =
  | { configured: false }
  | { configured: true; lastWeek: StoredSnapshot | null; lastMonth: StoredSnapshot | null; error?: string };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function weekPath(t: number) {
  return `pipeline/week/${hermosilloDate(startOfWeek(t))}.json`;
}

function monthPath(monthStart: number) {
  return `pipeline/month/${hermosilloDate(monthStart).slice(0, 7)}.json`;
}

async function read(pathname: string, useCache: boolean): Promise<StoredSnapshot | null> {
  const res = await get(pathname, { access: "private", useCache });
  if (!res || res.statusCode !== 200) return null;
  return (await new Response(res.stream).json()) as StoredSnapshot;
}

function sameCounts(a: StoredSnapshot | null, b: PipelineSnapshot) {
  return a !== null && a.inConversation === b.inConversation && a.open === b.open && a.noResponse === b.noResponse;
}

/** Saves `current` as this week's and this month's state, and returns last week's and last month's. */
export async function recordPipelineSnapshot(current: PipelineSnapshot): Promise<PipelineHistory> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { configured: false };

  const now = Date.now();
  const thisWeek = weekPath(now);
  const thisMonth = monthPath(startOfMonth(now));
  try {
    const [lastWeek, lastMonth, storedWeek, storedMonth] = await Promise.all([
      read(weekPath(now - WEEK_MS), true),
      read(monthPath(startOfMonth(now, 1)), true),
      read(thisWeek, false),
      read(thisMonth, false),
    ]);

    // Only write when the counts moved, to stay well inside the Blob free tier's write quota.
    const body = JSON.stringify({ ...current, recordedAt: new Date(now).toISOString() } satisfies StoredSnapshot);
    const opts = { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" } as const;
    await Promise.all([
      sameCounts(storedWeek, current) ? null : put(thisWeek, body, opts),
      sameCounts(storedMonth, current) ? null : put(thisMonth, body, opts),
    ]);
    return { configured: true, lastWeek, lastMonth };
  } catch (err) {
    console.error("Pipeline snapshot failed", err);
    return { configured: true, lastWeek: null, lastMonth: null, error: err instanceof Error ? err.message : String(err) };
  }
}
