import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getAllContacts, getAllConversations, getAllOpportunities, getPipelines } from "@/lib/ghl";
import {
  conversionSummary,
  firstTouchResponseTime,
  leadsBySource,
  leadsWeekOverWeek,
  pipelineByStage,
  stalledOpenOpportunities,
} from "@/lib/metrics";
import { WeeklyReport } from "../../../../emails/weekly-report";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locationId = process.env.GHL_LOCATION_ID;
  const resendApiKey = process.env.RESEND_API_KEY;
  const recipients = (process.env.REPORT_RECIPIENTS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const fromEmail = process.env.REPORT_FROM_EMAIL || "onboarding@resend.dev";
  const dashboardUrl = process.env.REPORT_DASHBOARD_URL || "https://example.com";
  const companyName = process.env.REPORT_COMPANY_NAME || "Reporte de crecimiento";

  if (!locationId) return NextResponse.json({ error: "Missing GHL_LOCATION_ID" }, { status: 500 });
  if (!resendApiKey) return NextResponse.json({ error: "Missing RESEND_API_KEY" }, { status: 500 });
  if (recipients.length === 0) return NextResponse.json({ error: "Missing REPORT_RECIPIENTS" }, { status: 500 });

  const [contacts, opportunities, pipelines, conversations] = await Promise.all([
    getAllContacts(locationId),
    getAllOpportunities(locationId),
    getPipelines(locationId),
    getAllConversations(locationId),
  ]);

  const bySource = leadsBySource(contacts);
  const byStage = pipelineByStage(opportunities, pipelines);
  const conversion = conversionSummary(opportunities, pipelines);
  const responseTime = firstTouchResponseTime(contacts, conversations);
  const wow = leadsWeekOverWeek(contacts);
  const stalled = stalledOpenOpportunities(opportunities, pipelines, 14);

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const fmt = (d: Date) => d.toLocaleDateString("es-MX", { day: "numeric", month: "long", timeZone: "America/Hermosillo" });
  const periodLabel = `${fmt(weekAgo)} – ${fmt(now)}, ${now.getFullYear()}`;

  const resend = new Resend(resendApiKey);
  const { data, error } = await resend.emails.send(
    {
      from: fromEmail,
      to: recipients,
      subject: `${companyName} — Reporte semanal (${wow.thisWeek} leads, ${(conversion.winRate * 100).toFixed(0)}% cierre)`,
      react: (
        <WeeklyReport
          companyName={companyName}
          dashboardUrl={dashboardUrl}
          periodLabel={periodLabel}
          bySource={bySource}
          byStage={byStage}
          conversion={conversion}
          responseTime={responseTime}
          wow={wow}
          stalled={stalled}
        />
      ),
    },
    { idempotencyKey: `weekly-report/${locationId}/${now.toISOString().slice(0, 10)}` }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  return NextResponse.json({ sent: true, id: data?.id, recipients });
}
