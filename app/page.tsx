import { getAllContacts, getAllConversations, getAllOpportunities, getPipelines } from "@/lib/ghl";
import {
  conversionSummary,
  firstTouchResponseTime,
  formatMinutes,
  leadsByCity,
  leadsBySource,
  leadsOverTime,
  leadsWeekOverWeek,
  opportunitiesByPipeline,
  pipelineByStage,
  stalledOpenOpportunities,
} from "@/lib/metrics";
import { StatTile } from "@/components/StatTile";
import { BarChart } from "@/components/BarChart";
import { LineChart } from "@/components/LineChart";
import { SectionLabel } from "@/components/SectionLabel";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) {
    throw new Error("Missing GHL_LOCATION_ID env var");
  }

  const [contacts, opportunities, pipelines, conversations] = await Promise.all([
    getAllContacts(locationId),
    getAllOpportunities(locationId),
    getPipelines(locationId),
    getAllConversations(locationId),
  ]);

  const bySource = leadsBySource(contacts);
  const byCity = leadsByCity(contacts);
  const overTime = leadsOverTime(contacts, 30);
  const byStage = pipelineByStage(opportunities, pipelines);
  const byPipeline = opportunitiesByPipeline(opportunities, pipelines);
  const conversion = conversionSummary(opportunities, pipelines);
  const responseTime = firstTouchResponseTime(contacts, conversations);
  const wow = leadsWeekOverWeek(contacts);
  const stalled = stalledOpenOpportunities(opportunities, pipelines, 14);

  const generatedAt = new Date().toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Hermosillo",
  });

  const companyName = process.env.REPORT_COMPANY_NAME || "Nombre de empresa pendiente";
  const isPartnership = companyName.includes("/");
  const [leadGenPartner, salesCompany] = isPartnership
    ? companyName.split("/").map((s) => s.trim())
    : [null, companyName];
  const companyInitial = isPartnership
    ? (leadGenPartner?.[0] || "") + (salesCompany?.[0] || "")
    : companyName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="w-full min-h-screen" style={{ background: "var(--page-plane)" }}>
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-10 flex flex-col gap-10">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-semibold shrink-0"
              style={{ background: "var(--series-1)", color: "#ffffff" }}
              aria-hidden
            >
              {companyInitial}
            </div>
            <div>
              <h1 className="text-2xl font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
                {companyName}
              </h1>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {isPartnership
                  ? `${leadGenPartner} genera los leads · ${salesCompany} los vende`
                  : "Reporte de crecimiento"}
                {" · "}
                {contacts.length} contactos · {opportunities.length} oportunidades
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:items-end gap-1">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full w-fit"
              style={{ background: "color-mix(in srgb, var(--status-good) 14%, transparent)", color: "var(--status-good)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--status-good)" }} />
              Datos en vivo
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Actualizado {generatedAt}
            </span>
          </div>
        </header>

        <section>
          <SectionLabel>Resumen</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatTile
              label="Leads esta semana"
              value={wow.thisWeek.toLocaleString("es-MX")}
              delta={wow.deltaPct !== null ? { pct: wow.deltaPct, caption: `vs. ${wow.lastWeek} la semana anterior` } : null}
            />
            <StatTile
              label="Tasa de cierre"
              value={`${(conversion.winRate * 100).toFixed(0)}%`}
              sublabel={`${conversion.won} ganadas de ${conversion.won + conversion.lost} cerradas`}
              accent={conversion.winRate >= 0.4 ? "good" : conversion.winRate > 0 ? "warning" : "neutral"}
            />
            <StatTile
              label="Tiempo a primer contacto (mediana)"
              value={formatMinutes(responseTime.medianMinutes)}
              sublabel={
                responseTime.sampleSize > 0
                  ? `sobre ${responseTime.sampleSize} leads con seguimiento registrado`
                  : "sin datos suficientes todavía"
              }
              accent="good"
            />
          </div>
        </section>

        <section>
          <SectionLabel>Adquisición de leads</SectionLabel>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BarChart title="Leads por fuente / campaña" data={bySource} />
            <LineChart title="Leads nuevos por día (últimos 30 días)" data={overTime} />
          </div>
          <div className="grid grid-cols-1 mt-4">
            <BarChart title="Leads por ciudad" data={byCity} />
          </div>
        </section>

        <section>
          <SectionLabel>Pipeline de ventas</SectionLabel>
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-4">
            <BarChart
              title="Oportunidades por etapa (todos los pipelines)"
              data={byStage.map((s) => ({ label: s.label, value: s.value }))}
            />
            <StatTile
              label="Leads estancados"
              value={stalled.stalledCount.toLocaleString("es-MX")}
              sublabel={`de ${stalled.openCount} abiertos, sin mover de etapa en ${stalled.thresholdDays}+ días`}
              accent={stalled.stalledCount > 0 ? "warning" : "good"}
            />
          </div>
          <BarChart title="Oportunidades por línea de producto" data={byPipeline} />
          <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
            La etapa &ldquo;Litio&rdquo; es una etapa real de su pipeline (no un error de este reporte) —
            parece usarse para marcar leads interesados específicamente en baterías de litio, no como
            resultado ganado/perdido.
          </p>
        </section>

        <section>
          <SectionLabel>Velocidad de respuesta</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatTile
              label="Respuesta en menos de 5 min"
              value={responseTime.sampleSize > 0 ? `${Math.round((responseTime.under5min / responseTime.sampleSize) * 100)}%` : "—"}
              accent="good"
            />
            <StatTile
              label="Respuesta en menos de 1 hora"
              value={responseTime.sampleSize > 0 ? `${Math.round((responseTime.under1hour / responseTime.sampleSize) * 100)}%` : "—"}
              accent="good"
            />
            <StatTile
              label="Sin respuesta después de 24 horas"
              value={responseTime.sampleSize > 0 ? `${Math.round((responseTime.overADay / responseTime.sampleSize) * 100)}%` : "—"}
              accent={responseTime.overADay > 0 ? "warning" : "neutral"}
            />
          </div>
        </section>

        <footer className="text-xs pt-2 pb-6 border-t" style={{ color: "var(--text-muted)", borderColor: "var(--gridline)" }}>
          <p className="pt-4">
            &ldquo;Tiempo a primer contacto&rdquo; mide el tiempo entre la creación del lead y el primer hilo
            de conversación registrado en el CRM — es una aproximación, no el tiempo de respuesta humano exacto.
          </p>
        </footer>
      </div>
    </div>
  );
}
