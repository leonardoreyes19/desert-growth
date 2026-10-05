/**
 * Rebuilds past weekly and monthly pipeline snapshots from GHL's opportunity
 * activity log (every create / stage change / status change / delete is
 * logged as an activity message in the contact's conversation) and writes
 * them to the Blob store the dashboard compares against.
 *
 * Only closed periods are written; the current week and month keep being
 * recorded live by the dashboard and the nightly cron. It also stores the
 * opportunity stage history itself (history/opportunity-events.json), which
 * the app otherwise refreshes hourly in the background.
 *
 *   node --experimental-strip-types scripts/backfill-pipeline-history.ts [--dry-run]
 *
 * Reads GHL_PRIVATE_INTEGRATION_TOKEN, GHL_LOCATION_ID and BLOB_READ_WRITE_TOKEN from .env.local.
 */
import fs from "node:fs";
import { put } from "@vercel/blob";
import { hermosilloDate, snapshotFromStages, startOfMonth, startOfWeek, type PipelineSnapshot } from "../lib/metrics.ts";
import { monthPath, weekPath, type StoredSnapshot } from "../lib/snapshot-paths.ts";
import { fetchOpportunityEvents, type OppEvent, type OppEventLog } from "../lib/opportunity-events.ts";

for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
// The Blob SDK prefers OIDC when a token is present; this script uses the read-write token.
delete process.env.VERCEL_OIDC_TOKEN;

const dryRun = process.argv.includes("--dry-run");
const locationId = process.env.GHL_LOCATION_ID!;
const headers = {
  Authorization: `Bearer ${process.env.GHL_PRIVATE_INTEGRATION_TOKEN}`,
  Version: "2021-07-28",
  Accept: "application/json",
};

async function ghl<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const url = new URL("https://services.leadconnectorhq.com" + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    const res = await fetch(url, { headers });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`GHL ${res.status} on ${path}: ${(await res.text()).slice(0, 300)}`);
    return res.json() as Promise<T>;
  }
  throw new Error(`GHL rate limit on ${path}`);
}

/** Pipeline as it stood at time `t`: each opportunity's last logged state before `t`. */
function snapshotAt(log: OppEventLog, t: number): PipelineSnapshot {
  const states: { stageName: string; status: string }[] = [];
  for (const events of Object.values(log)) {
    let last: OppEvent | undefined;
    for (const e of events) if (e.t < t) last = e;
    if (last && !last.deleted) states.push({ stageName: last.stage, status: last.status });
  }
  return snapshotFromStages(states);
}

async function livePipeline(): Promise<PipelineSnapshot> {
  const { pipelines } = await ghl<{ pipelines: { stages: { id: string; name: string }[] }[] }>("/opportunities/pipelines", {
    locationId,
  });
  const stageName = new Map(pipelines.flatMap((p) => p.stages.map((s) => [s.id, s.name] as const)));
  const opps: { pipelineStageId: string; status: string }[] = [];
  let startAfter: number | undefined;
  let startAfterId: string | undefined;
  for (let page = 0; page < 50; page++) {
    const params: Record<string, string | number> = { location_id: locationId, limit: 100 };
    if (startAfter) params.startAfter = startAfter;
    if (startAfterId) params.startAfterId = startAfterId;
    const data = await ghl<{
      opportunities: { pipelineStageId: string; status: string }[];
      meta: { nextPage?: number; startAfter?: number; startAfterId?: string };
    }>("/opportunities/search", params);
    opps.push(...data.opportunities);
    if (!data.meta?.nextPage || data.opportunities.length === 0) break;
    startAfter = data.meta.startAfter;
    startAfterId = data.meta.startAfterId;
  }
  return snapshotFromStages(opps.map((o) => ({ stageName: stageName.get(o.pipelineStageId) ?? "", status: o.status })));
}

const now = Date.now();
const [byOpp, live] = await Promise.all([
  fetchOpportunityEvents(process.env.GHL_PRIVATE_INTEGRATION_TOKEN!, locationId),
  livePipeline(),
]);
const rebuiltNow = snapshotAt(byOpp, now + 1);
console.log(`${Object.keys(byOpp).length} opportunities in the activity log`);
console.log("Rebuilt now:", rebuiltNow, "\nLive GHL:   ", live);
if (JSON.stringify(rebuiltNow) !== JSON.stringify(live)) {
  console.error("The rebuilt current pipeline doesn't match GHL — not writing anything.");
  process.exit(1);
}

const firstEvent = Math.min(...Object.values(byOpp).map((e) => e[0].t));
const writes: { path: string; at: number }[] = [];
// A week's file holds the state at the next Monday 00:00; a month's at the next 1st 00:00.
for (let close = startOfWeek(firstEvent) + 7 * 86_400_000; close <= startOfWeek(now); close += 7 * 86_400_000) {
  writes.push({ path: weekPath(close - 7 * 86_400_000), at: close });
}
for (let back = 1; startOfMonth(now, back - 1) > firstEvent; back++) {
  writes.push({ path: monthPath(startOfMonth(now, back)), at: startOfMonth(now, back - 1) });
}

for (const w of writes.sort((a, b) => a.path.localeCompare(b.path))) {
  const entry: StoredSnapshot = { ...snapshotAt(byOpp, w.at), recordedAt: new Date(w.at).toISOString(), reconstructed: true };
  console.log(`${w.path}  (cierre ${hermosilloDate(w.at - 1)})`, entry.inConversation, entry.open, entry.noResponse);
  if (!dryRun) {
    await put(w.path, JSON.stringify(entry), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
  }
}
const blobOpts = { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" } as const;
if (!dryRun) {
  // Also seed the stored stage history the dashboard reads (lib/opportunity-history.ts).
  await put("history/opportunity-events.json", JSON.stringify({ fetchedAt: new Date(now).toISOString(), log: byOpp }), blobOpts);
}
console.log(dryRun ? "Dry run — nothing written." : `Wrote ${writes.length} snapshots and the opportunity history.`);
