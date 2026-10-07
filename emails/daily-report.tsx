import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Tailwind, Text, pixelBasedPreset } from "react-email";
import type { ReactNode } from "react";
import type { Compared, DailyReportData } from "../lib/daily-report";
import { formatMinutes } from "../lib/metrics";

const BRAND = "#2a78d6";
const INK = "#0b0b0b";
const MUTED = "#6b6a66";
const BORDER = "#e5e4dd";
const SURFACE = "#fcfcfb";
const GOOD = "#1f8a4c";
const BAD = "#c2410c";
const TZ = "America/Hermosillo";

const money = (n: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
const num = (n: number) => n.toLocaleString("es-MX");
const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);
const dayLabel = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString("es-MX", { timeZone: TZ, ...opts });

/** "▲ 33% vs. 3" style comparison; `higherIsBetter` decides the colour (null = neutral, e.g. spend). */
function Delta({
  value,
  previous,
  format,
  higherIsBetter = true,
}: Compared & { format: (n: number) => string; higherIsBetter?: boolean | null }) {
  if (previous === null) return null;
  const change = previous > 0 ? (value - previous) / previous : null;
  const up = value > previous;
  const color = value === previous || higherIsBetter === null ? MUTED : up === higherIsBetter ? GOOD : BAD;
  return (
    <span style={{ color }}>
      {change === null ? "" : `${up ? "▲" : value < previous ? "▼" : "="} ${Math.abs(Math.round(change * 100))}% `}
      <span style={{ color: MUTED }}>vs. {format(previous)}</span>
    </span>
  );
}

function Cell({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <td width="50%" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px", verticalAlign: "top" }}>
      <Text style={{ fontSize: 12, color: MUTED, margin: "0 0 4px" }}>{label}</Text>
      <Text style={{ fontSize: 20, fontWeight: 600, color: INK, margin: "0 0 2px" }}>{value}</Text>
      {children && <Text style={{ fontSize: 11, color: MUTED, margin: 0 }}>{children}</Text>}
    </td>
  );
}

function Grid({ cells }: { cells: ReactNode[] }) {
  const rows: ReactNode[][] = [];
  for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2));
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={8} style={{ margin: "0 -8px" }}>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row}
            {row.length === 1 && <td width="50%" />}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Title({ children }: { children: ReactNode }) {
  return <Heading as="h2" style={{ fontSize: 14, color: INK, margin: "20px 0 4px" }}>{children}</Heading>;
}

export interface DailyReportProps {
  companyName: string;
  dashboardUrl: string;
  report: DailyReportData;
}

export default function DailyReport({ companyName, dashboardUrl, report: r }: DailyReportProps) {
  const month = dayLabel(r.monthStartIso, { month: "long", year: "numeric" });
  const prevMonth = dayLabel(r.prevMonthStartIso, { month: "long" });
  const cutDay = dayLabel(`${r.cutDate}T12:00:00-07:00`, { weekday: "long", day: "numeric", month: "long" });
  const dayOfMonth = Number(r.cutDate.slice(8, 10));
  const scope = r.monthClosed ? `Cierre de ${month}` : `${month[0].toUpperCase()}${month.slice(1)}, del 1 al ${dayOfMonth}`;
  const vsWhat = r.monthClosed ? `${prevMonth} completo` : `${prevMonth} al día ${dayOfMonth}`;
  const m = r.month;
  const p = r.pipeline;

  return (
    <Html lang="es" dir="ltr">
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Head />
        <Preview>{`${scope}: ${num(m.newLeads.thisWeek)} leads nuevos · ${num(m.sales.value)} ventas por ${money(m.salesValue.value)}`}</Preview>
        <Body style={{ background: "#f4f3ef", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif", margin: 0, padding: "24px 0" }}>
          <Container style={{ background: "#ffffff", borderRadius: 16, padding: "28px 24px", maxWidth: 600 }}>
            <Text style={{ fontSize: 12, color: MUTED, margin: 0 }}>{companyName} · Reporte diario</Text>
            <Heading as="h1" style={{ fontSize: 22, color: INK, margin: "4px 0 2px" }}>{scope}</Heading>
            <Text style={{ fontSize: 13, color: MUTED, margin: 0 }}>
              Datos al corte del {cutDay} · comparado con {vsWhat}
            </Text>

            <Title>Ayer ({cutDay})</Title>
            <Grid
              cells={[
                <Cell key="l" label="Leads nuevos" value={num(r.yesterday.newLeads)} />,
                <Cell key="q" label="Cotizaciones enviadas" value={num(r.yesterday.quotes)}>
                  {r.yesterday.quotedValue > 0 ? money(r.yesterday.quotedValue) : undefined}
                </Cell>,
                <Cell key="s" label="Ventas cerradas" value={num(r.yesterday.sales)}>
                  {r.yesterday.salesValue > 0 ? money(r.yesterday.salesValue) : undefined}
                </Cell>,
              ]}
            />

            <Title>El mes al corte</Title>
            <Grid
              cells={[
                <Cell key="l" label="Leads nuevos" value={num(m.newLeads.thisWeek)}>
                  <Delta value={m.newLeads.thisWeek} previous={m.newLeads.lastWeek} format={num} />
                </Cell>,
                <Cell key="q" label="Cotizaciones enviadas" value={num(m.quotes.value)}>
                  {money(m.quotedValue)} · <Delta {...m.quotes} format={num} />
                </Cell>,
                <Cell key="s" label="Ventas cerradas" value={money(m.salesValue.value)}>
                  {num(m.sales.value)} ventas · <Delta {...m.salesValue} format={money} />
                </Cell>,
                <Cell key="c" label="Tasa de cierre" value={pct(m.closeRate)}>
                  ganadas ÷ (ganadas + perdidas) en el mes
                </Cell>,
              ]}
            />

            <Title>Inversión en Meta</Title>
            <Grid
              cells={[
                <Cell key="i" label="Inversión" value={money(m.spend.value)}>
                  <Delta {...m.spend} format={money} higherIsBetter={null} />
                </Cell>,
                <Cell key="r" label="Retorno (ROAS)" value={m.roas === null ? "—" : `${m.roas.toFixed(1)}x`}>
                  ventas del mes ÷ inversión del mes
                </Cell>,
                <Cell key="cpl" label="Costo por lead (CRM)" value={m.cpl === null ? "—" : money(m.cpl)}>
                  inversión ÷ leads de anuncios en el CRM
                </Cell>,
                <Cell key="ml" label="Leads reportados por Meta" value={m.metaLeads === null ? "—" : num(m.metaLeads)} />,
              ]}
            />
            {r.metaError && <Text style={{ fontSize: 11, color: BAD, margin: "4px 0 0" }}>No se pudo leer Meta Ads: {r.metaError}</Text>}

            <Title>Pipeline al corte</Title>
            <Grid
              cells={[
                <Cell key="c" label="En conversación" value={num(p.now.inConversation)}>
                  {p.prevMonthClose && <Delta value={p.now.inConversation} previous={p.prevMonthClose.inConversation} format={num} />}
                </Cell>,
                <Cell key="o" label="Abiertos" value={num(p.now.open)}>
                  {p.prevMonthClose && <Delta value={p.now.open} previous={p.prevMonthClose.open} format={num} />}
                </Cell>,
                <Cell key="n" label="Sin respuesta" value={num(p.now.noResponse)}>
                  {p.prevMonthClose && <Delta value={p.now.noResponse} previous={p.prevMonthClose.noResponse} format={num} higherIsBetter={false} />}
                </Cell>,
                <Cell key="e" label="Estancados" value={num(p.stalled)}>
                  abiertos sin cotización, 14+ días sin moverse
                </Cell>,
              ]}
            />
            {p.prevMonthClose && <Text style={{ fontSize: 11, color: MUTED, margin: "2px 0 0" }}>Comparado con el cierre de {prevMonth}.</Text>}

            <Title>Respuesta a leads del mes</Title>
            <Grid
              cells={[
                <Cell key="a" label="Tiempo promedio para contestar" value={r.response.avgMinutes === null ? "—" : formatMinutes(r.response.avgMinutes)}>
                  {r.response.repliedCount === 1
                    ? "lo que tardó en contestarse 1 lead"
                    : r.response.repliedCount > 1
                      ? `promedio de ${r.response.repliedCount} leads respondidos`
                      : "sin respuestas registradas"}
                </Cell>,
                <Cell
                  key="n"
                  label="Sin respuesta después de 24 h"
                  value={r.response.settledCount > 0 ? pct(r.response.noReplyIn24h / r.response.settledCount) : "—"}
                >
                  {r.response.settledCount > 0 ? `${r.response.noReplyIn24h} de ${r.response.settledCount} leads` : undefined}
                </Cell>,
              ]}
            />

            <Section style={{ marginTop: 24, textAlign: "center" }}>
              <Button
                href={dashboardUrl}
                style={{ background: BRAND, color: "#ffffff", padding: "12px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none" }}
              >
                Abrir el dashboard
              </Button>
            </Section>

            <Hr style={{ borderColor: BORDER, borderTop: "1px solid", margin: "24px 0 12px" }} />
            <Text style={{ fontSize: 11, color: MUTED, margin: 0, lineHeight: "16px" }}>
              Cada número cuenta lo que pasó en el periodo: leads que llegaron, cotizaciones enviadas y ventas cerradas en esas
              fechas, aunque el lead haya llegado antes. El tiempo para contestar solo cuenta mensajes que manda una persona desde
              GHL o el WhatsApp conectado. Fuentes: GoHighLevel y Meta Ads · horario de Hermosillo.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

DailyReport.PreviewProps = {
  companyName: "Desert Growth / MALPA",
  dashboardUrl: "https://dashboard.malpa.com.mx",
  report: {
    cutIso: "2026-10-07T07:00:00.000Z",
    cutDate: "2026-10-06",
    monthStartIso: "2026-10-01T07:00:00.000Z",
    prevMonthStartIso: "2026-09-01T07:00:00.000Z",
    monthClosed: false,
    yesterday: { newLeads: 2, quotes: 1, quotedValue: 18500, sales: 0, salesValue: 0 },
    month: {
      newLeads: { thisWeek: 6, lastWeek: 4, deltaPct: 0.5 },
      quotes: { value: 3, previous: 1 },
      quotedValue: 56000,
      sales: { value: 1, previous: 0 },
      salesValue: { value: 16791, previous: 0 },
      closeRate: 0.5,
      spend: { value: 2400, previous: 2534 },
      cpl: 300,
      roas: 7,
      metaLeads: 9,
    },
    pipeline: { now: { inConversation: 121, open: 181, noResponse: 57 }, prevMonthClose: { inConversation: 122, open: 180, noResponse: 58 }, stalled: 30 },
    response: { avgMinutes: 95, repliedCount: 3, settledCount: 5, noReplyIn24h: 2 },
    metaError: null,
  },
} satisfies DailyReportProps;
