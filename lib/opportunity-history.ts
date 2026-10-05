import "server-only";
import { after } from "next/server";
import { get, put } from "@vercel/blob";
import { fetchOpportunityEvents, type OppEventLog } from "./opportunity-events";
import { cached } from "./server-cache";

/**
 * The opportunity history (lib/opportunity-events.ts) costs ~200 GHL calls to
 * build, so it lives in the Blob store and is refreshed in the background when
 * it's over an hour old, plus nightly by the pipeline-snapshot cron.
 */

const PATH = "history/opportunity-events.json";
const STALE_MS = 60 * 60 * 1000;

type Stored = { fetchedAt: string; log: OppEventLog };

let refreshing: Promise<Stored> | null = null;

async function readStored(): Promise<Stored | null> {
  const res = await get(PATH, { access: "private", useCache: false });
  if (!res || res.statusCode !== 200) return null;
  return (await new Response(res.stream).json()) as Stored;
}

/** Rebuilds the history from GHL and stores it. */
export function refreshOpportunityEvents(): Promise<Stored> {
  refreshing ??= (async () => {
    try {
      const token = process.env.GHL_PRIVATE_INTEGRATION_TOKEN;
      const locationId = process.env.GHL_LOCATION_ID;
      if (!token || !locationId) throw new Error("Missing GHL env vars");
      const stored: Stored = { fetchedAt: new Date().toISOString(), log: await fetchOpportunityEvents(token, locationId) };
      await put(PATH, JSON.stringify(stored), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      return stored;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** The stored history (null if there's none yet), scheduling a background refresh when it's stale. */
export async function getOpportunityEvents(): Promise<OppEventLog | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  let stored: Stored | null = null;
  try {
    stored = await cached("opportunity-events", readStored, { keep: (v) => v !== null });
  } catch (err) {
    console.error("Reading opportunity history failed", err);
  }
  if (!stored || Date.now() - new Date(stored.fetchedAt).getTime() > STALE_MS) {
    after(() => refreshOpportunityEvents().catch((err) => console.error("Refreshing opportunity history failed", err)));
  }
  return stored?.log ?? null;
}
