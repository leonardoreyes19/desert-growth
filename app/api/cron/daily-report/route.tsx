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
 * 1st). Vercel Cron calls it Monday to Friday mornings (Monday's covers the
 * weekend); `?dry=1` returns the HTML instead
 * of sending (add `&fecha=YYYY-MM-DD` to preview another morning), and `?test=1` sends a "[Prueba]" copy that doesn't count as the
 * day's email. REPORT_RECIPIENTS is a comma-separated list.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyName = process.env.REPORT_COMPANY_NAME || "Reporte de crecimiento";
  const dashboardBase = process.env.REPORT_DASHBOARD_URL || "https://dashboard.malpa.com.mx";
  // ?fecha=YYYY-MM-DD previews the email as it would go out that morning (dry runs only).
  const fecha = req.nextUrl.searchParams.get("fecha");
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const at = dry && fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? Date.parse(`${fecha}T07:30:00-07:00`) : undefined;
  const report = await buildDailyReport(at);
  const dashboardUrl = `${dashboardBase}/?mes=${report.cutDate.slice(0, 7)}`;
  const html = await render(<DailyReport companyName={companyName} dashboardUrl={dashboardUrl} report={report} />);

  if (dry) {
    return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const recipients = (process.env.REPORT_RECIPIENTS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!resendApiKey) return NextResponse.json({ error: "Missing RESEND_API_KEY" }, { status: 500 });
  if (recipients.length === 0) return NextResponse.json({ error: "Missing REPORT_RECIPIENTS" }, { status: 500 });
  const resend = new Resend(resendApiKey);
  const from = await senderAddress(resend, companyName);

  const cutDay = new Date(`${report.cutDate}T12:00:00-07:00`).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    timeZone: "America/Hermosillo",
  });
  const test = req.nextUrl.searchParams.get("test") === "1";
  const subject = (test ? "[Prueba] " : "") + (report.monthClosed
    ? `${companyName} — Cierre del mes (al ${cutDay})`
    : `${companyName} — Reporte diario al ${cutDay}`);

  // One email per recipient, so one bad address (or one the sandbox sender can't reach) doesn't block the rest.
  const runId = test ? crypto.randomUUID() : null;
  const results = await Promise.all(
    recipients.map(async (to) => {
      const { data, error } = await resend.emails.send(
        { from, to: [to], subject, html },
        // One email per recipient and cut date, even if the cron retries; test sends never collide with it.
        { idempotencyKey: runId ? `daily-report-test/${report.cutDate}/${runId}/${to}` : `daily-report/${report.cutDate}/${to}` }
      );
      return error ? { to, error: error.message } : { to, id: data?.id };
    })
  );
  const failed = results.filter((r) => "error" in r);
  return NextResponse.json(
    { ok: failed.length === 0, from, cutDate: report.cutDate, results },
    { status: failed.length === results.length ? 500 : 200 }
  );
}

/**
 * reportes@<domain> once the domain connected to Resend (RESEND_EMAIL_DOMAIN)
 * is verified; until then Resend's sandbox address, which only delivers to the
 * Resend account owner. While unverified it asks Resend to re-check the DNS,
 * so the switch happens on its own once the records are in place.
 */
async function senderAddress(resend: Resend, companyName: string): Promise<string> {
  if (process.env.REPORT_FROM_EMAIL) return process.env.REPORT_FROM_EMAIL;
  const sandbox = `${companyName} <onboarding@resend.dev>`;
  const domainName = process.env.RESEND_EMAIL_DOMAIN;
  if (!domainName) return sandbox;
  const { data } = await resend.domains.list();
  const domain = data?.data.find((d) => d.name === domainName);
  if (!domain) return sandbox;
  if (domain.status === "verified") return `${companyName} <reportes@${domainName}>`;
  await resend.domains.verify(domain.id);
  return sandbox;
}
