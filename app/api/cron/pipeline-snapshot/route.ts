import { NextRequest, NextResponse } from "next/server";
import { getAllOpportunities, getPipelines } from "@/lib/ghl";
import { pipelineSnapshot } from "@/lib/metrics";
import { recordPipelineSnapshot } from "@/lib/snapshots";
import { refreshOpportunityEvents } from "@/lib/opportunity-history";

export const dynamic = "force-dynamic";
// Rebuilding the opportunity history walks every conversation (~1–2 min).
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Runs nightly so each week's and month's pipeline history is recorded even
 * on days nobody opens the dashboard (which also records it on every visit),
 * and rebuilds the opportunity stage history used for per-period numbers.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) return NextResponse.json({ error: "Missing GHL_LOCATION_ID" }, { status: 500 });

  const [opportunities, pipelines] = await Promise.all([getAllOpportunities(locationId), getPipelines(locationId)]);
  const snapshot = pipelineSnapshot(opportunities, pipelines);
  const [error, history] = await Promise.all([
    recordPipelineSnapshot(snapshot),
    refreshOpportunityEvents().then(
      (h) => ({ opportunities: Object.keys(h.log).length }),
      (err: unknown) => ({ error: err instanceof Error ? err.message : String(err) })
    ),
  ]);
  if (error || "error" in history) return NextResponse.json({ error: error ?? history }, { status: 500 });
  return NextResponse.json({ ok: true, snapshot, history });
}
