import { NextRequest, NextResponse } from "next/server";
import { render } from "react-email";
import { Resend } from "resend";
import { buildDailyReport } from "@/lib/daily-report";
import DailyReport from "../../../../emails/daily-report";

export const dynamic = "force-dynamic";
// Refreshes the stage history (~1–2 min) before building the report.
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Daily email with the month to date as of yesterday (the closed month on the
 * 1st). Vercel Cron calls it every morning; `?dry=1` returns the HTML instead
 * of sending, and `?test=1` sends a "[Prueba]" copy that doesn't count as the
 * day's email.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyName = process.env.REPORT_COMPANY_NAME || "Reporte de crecimiento";
  const dashboardBase = process.env.REPORT_DASHBOARD_URL || "https://dashboard.malpa.com.mx";
  const report = await buildDailyReport();
  const dashboardUrl = `${dashboardBase}/?mes=${report.cutDate.slice(0, 7)}`;
  const html = await render(<DailyReport companyName={companyName} dashboardUrl={dashboardUrl} report={report} />);

  if (req.nextUrl.searchParams.get("dry") === "1") {
    return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const recipients = (process.env.REPORT_RECIPIENTS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!resendApiKey) return NextResponse.json({ error: "Missing RESEND_API_KEY" }, { status: 500 });
  if (recipients.length === 0) return NextResponse.json({ error: "Missing REPORT_RECIPIENTS" }, { status: 500 });
  // Without a verified domain Resend only delivers from its sandbox address, to the account owner.
  const from = process.env.REPORT_FROM_EMAIL || `${companyName} <onboarding@resend.dev>`;

  const cutDay = new Date(`${report.cutDate}T12:00:00-07:00`).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    timeZone: "America/Hermosillo",
  });
  const test = req.nextUrl.searchParams.get("test") === "1";
  const subject = (test ? "[Prueba] " : "") + (report.monthClosed
    ? `${companyName} — Cierre del mes (al ${cutDay})`
    : `${companyName} — Reporte diario al ${cutDay}`);

  const resend = new Resend(resendApiKey);
  const { data, error } = await resend.emails.send(
    { from, to: recipients, subject, html },
    // One email per cut date, even if the cron retries; test sends never collide with it.
    { idempotencyKey: test ? `daily-report-test/${report.cutDate}/${crypto.randomUUID()}` : `daily-report/${report.cutDate}` }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data?.id, cutDate: report.cutDate, recipients: recipients.length });
}
