import "server-only";
import { get, put } from "@vercel/blob";
import { startOfMonth, type PipelineSnapshot } from "./metrics";
import type { PeriodRange } from "./periods";
import { monthPath, weekPath, type StoredSnapshot } from "./snapshot-paths";

/**
 * GHL only knows each lead's current stage, so to compare the pipeline with
 * earlier periods we keep our own history in a private Vercel Blob store: one
 * JSON file per week (named by its Monday) and one per month, each overwritten
 * with the latest state seen during that period. Once a period ends, its file
 * holds how the pipeline stood at its close. Periods before this existed were
 * rebuilt from GHL's activity log (scripts/backfill-pipeline-history.ts).
 */

export type PipelineHistory =
  | { configured: false }
  | {
      configured: true;
      /** The pipeline when the previous period closed. */
      previous: StoredSnapshot | null;
      /** For a finished month: the pipeline when that month closed. */
      atEnd: StoredSnapshot | null;
      error?: string;
    };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const configured = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

async function read(pathname: string, useCache: boolean): Promise<StoredSnapshot | null> {
  const res = await get(pathname, { access: "private", useCache });
  if (!res || res.statusCode !== 200) return null;
  return (await new Response(res.stream).json()) as StoredSnapshot;
}

function sameCounts(a: StoredSnapshot | null, b: PipelineSnapshot) {
  return a !== null && a.inConversation === b.inConversation && a.open === b.open && a.noResponse === b.noResponse;
}

/** Saves `current` as this week's and this month's state. Returns an error message if it failed. */
export async function recordPipelineSnapshot(current: PipelineSnapshot): Promise<string | null> {
  if (!configured()) return "Blob store is not configured";
  const now = Date.now();
  const thisWeek = weekPath(now);
  const thisMonth = monthPath(startOfMonth(now));
  try {
    const [storedWeek, storedMonth] = await Promise.all([read(thisWeek, false), read(thisMonth, false)]);
    // Only write when the counts moved, to stay well inside the Blob free tier's write quota.
    const body = JSON.stringify({ ...current, recordedAt: new Date(now).toISOString() } satisfies StoredSnapshot);
    const opts = { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" } as const;
    await Promise.all([
      sameCounts(storedWeek, current) ? null : put(thisWeek, body, opts),
      sameCounts(storedMonth, current) ? null : put(thisMonth, body, opts),
    ]);
    return null;
  } catch (err) {
    console.error("Pipeline snapshot failed", err);
    return err instanceof Error ? err.message : String(err);
  }
}

/** How the pipeline stood when the previous period closed (and, for a finished month, when it closed). */
export async function pipelineHistoryFor(range: PeriodRange): Promise<PipelineHistory> {
  if (!configured()) return { configured: false };
  // A week period starts on a Monday: that's the close of the week before it.
  const previousPath = range.key === "mes" ? monthPath(range.prevStart) : weekPath(range.start - WEEK_MS);
  try {
    const [previous, atEnd] = await Promise.all([
      read(previousPath, true),
      range.isPast ? read(monthPath(range.start), true) : null,
    ]);
    return { configured: true, previous, atEnd };
  } catch (err) {
    console.error("Reading pipeline history failed", err);
    return { configured: true, previous: null, atEnd: null, error: err instanceof Error ? err.message : String(err) };
  }
}
