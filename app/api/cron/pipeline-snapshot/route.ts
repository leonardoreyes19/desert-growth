import { NextRequest, NextResponse } from "next/server";
import { getAllOpportunities, getPipelines } from "@/lib/ghl";
import { pipelineSnapshot } from "@/lib/metrics";
import { recordPipelineSnapshot } from "@/lib/snapshots";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Runs nightly so each week's and month's pipeline history is recorded even
 * on days nobody opens the dashboard (which also records it on every visit).
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) return NextResponse.json({ error: "Missing GHL_LOCATION_ID" }, { status: 500 });

  const [opportunities, pipelines] = await Promise.all([getAllOpportunities(locationId), getPipelines(locationId)]);
  const snapshot = pipelineSnapshot(opportunities, pipelines);
  const history = await recordPipelineSnapshot(snapshot);
  if (!history.configured) return NextResponse.json({ error: "Blob store is not configured" }, { status: 500 });
  if (history.error) return NextResponse.json({ error: history.error }, { status: 500 });
  return NextResponse.json({ ok: true, snapshot });
}
