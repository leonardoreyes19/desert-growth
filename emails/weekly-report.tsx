import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from "react-email";
import type {
  ConversionSummary,
  ResponseTimeSummary,
  SourceCount,
  StageCount,
  StalledSummary,
  WeekOverWeek,
} from "../lib/metrics";
import { formatMinutes } from "../lib/metrics";

const BRAND = "#2a78d6";
const INK = "#0b0b0b";
const MUTED = "#6b6a66";
const BORDER = "#e5e4dd";
const SURFACE = "#fcfcfb";

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.max(2, Math.round((value / Math.max(1, max)) * 100));
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: 10 }}>
      <tbody>
        <tr>
          <td style={{ fontSize: 13, color: INK, paddingBottom: 4 }} colSpan={2}>
            {label}
          </td>
        </tr>
        <tr>
          <td style={{ padding: 0 }}>
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
              <tbody>
                <tr>
                  <td width={`${pct}%`} style={{ background: BRAND, height: 10, borderRadius: 4, fontSize: 1, lineHeight: "10px" }}>
                    &nbsp;
                  </td>
                  <td width={`${100 - pct}%`} style={{ fontSize: 1, lineHeight: "10px" }}>
                    &nbsp;
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
          <td width={48} align="right" style={{ fontSize: 13, color: INK, fontWeight: 600, whiteSpace: "nowrap", paddingLeft: 8 }}>
            {value.toLocaleString("es-MX")}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function StatCell({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <td
      style={{
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: "14px 16px",
        verticalAlign: "top",
      }}
    >
      <Text style={{ fontSize: 12, color: MUTED, margin: "0 0 4px" }}>{label}</Text>
      <Text style={{ fontSize: 22, fontWeight: 600, color: INK, margin: "0 0 2px" }}>{value}</Text>
      {sublabel && <Text style={{ fontSize: 11, color: MUTED, margin: 0 }}>{sublabel}</Text>}
    </td>
  );
}

export interface WeeklyReportProps {
  companyName: string;
  dashboardUrl: string;
  periodLabel: string;
  bySource: SourceCount[];
  byStage: StageCount[];
  conversion: ConversionSummary;
  responseTime: ResponseTimeSummary;
  wow: WeekOverWeek;
  stalled: StalledSummary;
}

export default function WeeklyReport({
  companyName,
  dashboardUrl,
  periodLabel,
  bySource,
  byStage,
  conversion,
  responseTime,
  wow,
  stalled,
}: WeeklyReportProps) {
  const maxSource = Math.max(1, ...bySource.map((s) => s.value));
  const maxStage = Math.max(1, ...byStage.map((s) => s.value));

  return (
    <Html lang="es" dir="ltr">
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Head />
        <Preview>{`${wow.thisWeek} leads esta semana · ${(conversion.winRate * 100).toFixed(0)}% tasa de cierre`}</Preview>
        <Body style={{ backgroundColor: "#f2f1ec", fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}>
          <Container style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px" }}>
            <Section>
              <Heading as="h1" style={{ fontSize: 20, color: INK, margin: "0 0 2px" }}>
                {companyName}
              </Heading>
              <Text style={{ fontSize: 13, color: MUTED, margin: 0 }}>
                Reporte semanal de crecimiento · {periodLabel}
              </Text>
            </Section>

            <Hr style={{ borderColor: BORDER, borderTop: "1px solid", margin: "16px 0" }} />

            <Section>
              <table role="presentation" width="100%" cellPadding={0} cellSpacing={8}>
                <tbody>
                  <tr>
                    <StatCell
                      label="Leads esta semana"
                      value={wow.thisWeek.toLocaleString("es-MX")}
                      sublabel={
                        wow.deltaPct !== null
                          ? `${wow.deltaPct >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(wow.deltaPct * 100))}% vs. semana anterior`
                          : undefined
                      }
                    />
                    <StatCell
                      label="Tasa de cierre"
                      value={`${(conversion.winRate * 100).toFixed(0)}%`}
                      sublabel={`${conversion.won} ganadas de ${conversion.won + conversion.lost}`}
                    />
                  </tr>
                  <tr>
                    <StatCell
                      label="Tiempo a primer contacto"
                      value={formatMinutes(responseTime.medianMinutes)}
                      sublabel="mediana"
                    />
                    <StatCell
                      label="Leads estancados"
                      value={stalled.stalledCount.toLocaleString("es-MX")}
                      sublabel={`de ${stalled.openCount} abiertos, ${stalled.thresholdDays}+ días sin mover`}
                    />
                  </tr>
                </tbody>
              </table>
            </Section>

            <Section style={{ marginTop: 20 }}>
              <Heading as="h2" style={{ fontSize: 14, color: INK, margin: "0 0 12px" }}>
                Leads por fuente / campaña
              </Heading>
              {bySource.map((s) => (
                <Bar key={s.label} label={s.label} value={s.value} max={maxSource} />
              ))}
            </Section>

            <Section style={{ marginTop: 8 }}>
              <Heading as="h2" style={{ fontSize: 14, color: INK, margin: "0 0 12px" }}>
                Oportunidades por etapa
              </Heading>
              {byStage.map((s) => (
                <Bar key={s.label} label={s.label} value={s.value} max={maxStage} />
              ))}
            </Section>

            <Section style={{ marginTop: 24, textAlign: "center" }}>
              <Button
                href={dashboardUrl}
                className="box-border"
                style={{
                  background: BRAND,
                  color: "#ffffff",
                  padding: "12px 24px",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Ver dashboard completo
              </Button>
            </Section>

            <Hr style={{ borderColor: BORDER, borderTop: "1px solid", margin: "24px 0 12px" }} />
            <Text style={{ fontSize: 11, color: MUTED, margin: 0, lineHeight: "16px" }}>
              &ldquo;Tiempo a primer contacto&rdquo; mide el tiempo entre la creación del lead y el primer
              hilo de conversación registrado en el CRM. Reporte generado automáticamente desde GoHighLevel.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

WeeklyReport.PreviewProps = {
  companyName: "Desert Growth / MALPA",
  dashboardUrl: "https://example.vercel.app",
  periodLabel: "1 – 8 de septiembre, 2026",
  bySource: [
    { label: "Malpa Carritos Intake", value: 114 },
    { label: "Malpa Baterias Marinas Intake", value: 69 },
    { label: "Desconocido", value: 2 },
  ],
  byStage: [
    { label: "Lead nuevo", value: 48, position: 0 },
    { label: "Contactado", value: 76, position: 1 },
    { label: "Sin respuesta", value: 17, position: 2 },
    { label: "Cotización enviada", value: 30, position: 3 },
    { label: "Ganado", value: 5, position: 5 },
    { label: "Perdido", value: 2, position: 6 },
  ],
  conversion: { total: 180, won: 5, lost: 2, open: 173, winRate: 0.71 },
  responseTime: { medianMinutes: 0.5, avgMinutes: 3, sampleSize: 100, under5min: 100, under1hour: 100, overADay: 0 },
  wow: { thisWeek: 10, lastWeek: 8, deltaPct: 0.25 },
  stalled: { thresholdDays: 14, stalledCount: 146, openCount: 173, oldestDays: 90 },
} satisfies WeeklyReportProps;

export { WeeklyReport };
