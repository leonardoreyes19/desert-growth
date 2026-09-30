import { extraDictionaries, type ExtraDict } from "./i18n-extra";

export type Lang = "es" | "en";

export const LANGS: Lang[] = ["es", "en"];
export const DEFAULT_LANG: Lang = "es";

export function localeFor(lang: Lang): string {
  return lang === "en" ? "en-US" : "es-MX";
}

export function isLang(value: string | undefined): value is Lang {
  return value === "es" || value === "en";
}

type Dict = {
  liveData: string;
  updatedAt: (date: string) => string;
  growthReport: string;
  partnership: (leadGen: string, sales: string) => string;
  contactsAndOpportunities: (contacts: number, opportunities: number) => string;

  summary: string;
  leadsThisWeek: string;
  inConversationSublabel: string;
  newLeadsThisWeek: string;
  openLeads: string;
  openLeadsSublabel: string;
  noResponseLeads: string;
  noResponseLeadsSublabel: string;
  vsLastWeek: (n: number) => string;
  thisMonthVsLastMonth: (n: number, prev: number) => string;
  vsLastWeekClose: (n: number) => string;
  vsLastMonthClose: (n: number) => string;
  noWeekHistory: string;
  noMonthHistory: string;
  closeRate: string;
  wonLostOpen: (won: number, lost: number, open: number) => string;
  medianFirstContact: string;
  overLeadsReplied: (n: number) => string;
  overSettledLeads: (n: number, since: string) => string;
  notEnoughData: string;

  advertisingMetaAds: string;
  metaNotConfigured: string;
  metaError: (msg: string) => string;
  metaSpend30d: string;
  metaCpl: string;
  metaLeadsReported: (n: string) => string;
  metaCtr: string;
  metaClicks: (n: string) => string;
  metaReach: string;
  metaImpressionsCpm: (impressions: string, cpm: string) => string;
  metaCampaignPerformance: string;
  campaignCol: string;
  spendCol: string;
  clicksCol: string;
  ctrCol: string;
  leadsCol: string;
  cplCol: string;
  metaLeadsFootnote: string;
  metaDailyTrend: string;
  metaSpendPerDay: string;
  metaLeadsPerDay: string;
  metaByDemographic: string;
  metaByPlacement: string;
  metaWeekOverWeek: string;
  metaSpendThisWeek: string;
  metaCplThisWeek: string;
  vsLastWeekAmount: (n: string) => string;
  genderMale: string;
  genderFemale: string;
  genderUnknown: string;

  leadAcquisition: string;
  leadsBySourceCampaign: string;
  newLeadsPerDay: string;
  leadsByCity: string;

  salesPipeline: string;
  opportunitiesByStage: string;
  stalledLeads: string;
  stalledSublabel: (open: number, days: number) => string;
  seeStalledLeads: string;
  opportunitiesByProductLine: string;
  lithiumFootnote: string;

  responseSpeed: string;
  responseUnder5min: string;
  responseUnder1hour: string;
  noResponse24h: string;

  firstContactFootnote: string;

  viewTable: string;
  viewChart: string;
  category: string;
  value: string;
  leadsOnPrefix: string;

  toggleTheme: string;
  language: string;

  crmGroupTitle: string;
  crmGroupSubtitle: string;
  metaGroupTitle: string;
  metaGroupSubtitle: string;

  tagFilterLabel: string;
  allLeads: string;
};

export const dictionaries: Record<Lang, Dict> = {
  es: {
    liveData: "Datos en vivo",
    updatedAt: (date) => `Actualizado ${date}`,
    growthReport: "Reporte de crecimiento",
    partnership: (leadGen, sales) => `${leadGen} genera los leads · ${sales} los vende`,
    contactsAndOpportunities: (contacts, opportunities) =>
      `${contacts} contactos · ${opportunities} oportunidades`,

    summary: "Resumen",
    leadsThisWeek: "Leads esta semana",
    inConversationSublabel: "En conversación: contactados, cotizados y en negociación",
    newLeadsThisWeek: "Leads nuevos esta semana",
    openLeads: "Leads abiertos",
    openLeadsSublabel: "Todo lo que no está ganado ni perdido",
    noResponseLeads: "Sin respuesta",
    noResponseLeadsSublabel: "Leads abiertos en la etapa Sin respuesta",
    vsLastWeek: (n) => `vs. ${n} a esta altura la semana pasada`,
    thisMonthVsLastMonth: (n, prev) => `Este mes ${n} · vs. ${prev} a esta altura el mes pasado`,
    vsLastWeekClose: (n) => `vs. ${n} al cierre de la semana pasada`,
    vsLastMonthClose: (n) => `vs. ${n} al cierre del mes pasado`,
    noWeekHistory: "Semana pasada: sin historial todavía",
    noMonthHistory: "Mes pasado: sin historial todavía",
    closeRate: "Tasa de cierre",
    wonLostOpen: (won, lost, open) => `${won} ganadas, ${lost} perdidas · ${open} siguen abiertas`,
    medianFirstContact: "Tiempo a primer contacto (mediana)",
    overLeadsReplied: (n) => (n === 1 ? "sobre 1 lead respondido" : `sobre ${n} leads respondidos`),
    overSettledLeads: (n, since) => `de ${n} ${n === 1 ? "lead" : "leads"} de más de 24 h, desde el ${since}`,
    notEnoughData: "sin datos suficientes todavía",

    advertisingMetaAds: "Publicidad · Meta Ads",
    metaNotConfigured:
      "Conecta Meta Ads (variables META_ACCESS_TOKEN y META_AD_ACCOUNT_ID) para ver inversión, costo por lead y rendimiento por campaña aquí.",
    metaError: (msg) => `No se pudieron leer los datos de Meta Ads: ${msg}`,
    metaSpend30d: "Inversión (30 días)",
    metaCpl: "Costo por lead",
    metaLeadsReported: (n) => `${n} leads reportados por Meta`,
    metaCtr: "CTR",
    metaClicks: (n) => `${n} clics`,
    metaReach: "Alcance",
    metaImpressionsCpm: (impressions, cpm) => `${impressions} impresiones · CPM ${cpm}`,
    metaCampaignPerformance: "Rendimiento por campaña",
    campaignCol: "Campaña",
    spendCol: "Inversión",
    clicksCol: "Clics",
    ctrCol: "CTR",
    leadsCol: "Leads",
    cplCol: "CPL",
    metaLeadsFootnote:
      "“Leads” son los que Meta contó vía el pixel (conversión configurada). Pueden diferir de los leads registrados en el CRM: el CRM es la fuente de verdad para los leads reales.",
    metaDailyTrend: "Tendencia diaria",
    metaSpendPerDay: "Inversión por día",
    metaLeadsPerDay: "Leads por día",
    metaByDemographic: "Por edad y género",
    metaByPlacement: "Por ubicación del anuncio",
    metaWeekOverWeek: "Esta semana vs. anterior",
    metaSpendThisWeek: "Inversión esta semana",
    metaCplThisWeek: "CPL esta semana",
    vsLastWeekAmount: (n) => `vs. ${n} la semana anterior`,
    genderMale: "Hombre",
    genderFemale: "Mujer",
    genderUnknown: "Desconocido",

    leadAcquisition: "Adquisición de leads",
    leadsBySourceCampaign: "Leads por fuente / campaña",
    newLeadsPerDay: "Leads nuevos por día (últimos 30 días)",
    leadsByCity: "Leads por ciudad",

    salesPipeline: "Pipeline de ventas",
    opportunitiesByStage: "Oportunidades por etapa (todos los pipelines)",
    stalledLeads: "Leads estancados",
    stalledSublabel: (open, days) => `de ${open} abiertos, sin mover de etapa en ${days}+ días`,
    seeStalledLeads: "Ver la lista",
    opportunitiesByProductLine: "Oportunidades por línea de producto",
    lithiumFootnote:
      "La etapa “Litio” es una etapa real de su pipeline (no un error de este reporte) — parece usarse para marcar leads interesados específicamente en baterías de litio, no como resultado ganado/perdido.",

    responseSpeed: "Velocidad de respuesta",
    responseUnder5min: "Respuesta en menos de 5 min",
    responseUnder1hour: "Respuesta en menos de 1 hora",
    noResponse24h: "Sin respuesta después de 24 horas",

    firstContactFootnote:
      "“Tiempo a primer contacto” y “Velocidad de respuesta” miden el tiempo entre la creación del lead y el primer mensaje que una persona le envía desde el CRM o el WhatsApp conectado (no cuentan los mensajes automáticos). Solo incluyen leads desde el 28 de septiembre de 2026, cuando se conectó WhatsApp; las respuestas hechas fuera del CRM no se ven.",

    viewTable: "Ver tabla",
    viewChart: "Ver gráfica",
    category: "Categoría",
    value: "Valor",
    leadsOnPrefix: "leads el",

    toggleTheme: "Cambiar tema",
    language: "Idioma",

    crmGroupTitle: "Datos del CRM (GoHighLevel)",
    crmGroupSubtitle: "Leads y oportunidades ya registrados en el CRM del equipo de ventas",
    metaGroupTitle: "Datos de Meta Ads",
    metaGroupSubtitle: "Lo que Meta reporta de tus campañas pagadas — puede no coincidir 1:1 con el CRM",

    tagFilterLabel: "Filtrar por etiqueta",
    allLeads: "Todos",
  },
  en: {
    liveData: "Live data",
    updatedAt: (date) => `Updated ${date}`,
    growthReport: "Growth report",
    partnership: (leadGen, sales) => `${leadGen} generates the leads · ${sales} sells them`,
    contactsAndOpportunities: (contacts, opportunities) =>
      `${contacts} contacts · ${opportunities} opportunities`,

    summary: "Summary",
    leadsThisWeek: "Leads this week",
    inConversationSublabel: "In conversation: contacted, quoted and negotiating",
    newLeadsThisWeek: "New leads this week",
    openLeads: "Open leads",
    openLeadsSublabel: "Everything not yet won or lost",
    noResponseLeads: "No response",
    noResponseLeadsSublabel: "Open leads in the No response stage",
    vsLastWeek: (n) => `vs. ${n} at this point last week`,
    thisMonthVsLastMonth: (n, prev) => `This month ${n} · vs. ${prev} at this point last month`,
    vsLastWeekClose: (n) => `vs. ${n} at the close of last week`,
    vsLastMonthClose: (n) => `vs. ${n} at the close of last month`,
    noWeekHistory: "Last week: no history yet",
    noMonthHistory: "Last month: no history yet",
    closeRate: "Close rate",
    wonLostOpen: (won, lost, open) => `${won} won, ${lost} lost · ${open} still open`,
    medianFirstContact: "Time to first contact (median)",
    overLeadsReplied: (n) => (n === 1 ? "over 1 answered lead" : `over ${n} answered leads`),
    overSettledLeads: (n, since) => `of ${n} ${n === 1 ? "lead" : "leads"} older than 24 h, since ${since}`,
    notEnoughData: "not enough data yet",

    advertisingMetaAds: "Advertising · Meta Ads",
    metaNotConfigured:
      "Connect Meta Ads (META_ACCESS_TOKEN and META_AD_ACCOUNT_ID variables) to see spend, cost per lead, and campaign performance here.",
    metaError: (msg) => `Couldn't load Meta Ads data: ${msg}`,
    metaSpend30d: "Spend (30 days)",
    metaCpl: "Cost per lead",
    metaLeadsReported: (n) => `${n} leads reported by Meta`,
    metaCtr: "CTR",
    metaClicks: (n) => `${n} clicks`,
    metaReach: "Reach",
    metaImpressionsCpm: (impressions, cpm) => `${impressions} impressions · CPM ${cpm}`,
    metaCampaignPerformance: "Campaign performance",
    campaignCol: "Campaign",
    spendCol: "Spend",
    clicksCol: "Clicks",
    ctrCol: "CTR",
    leadsCol: "Leads",
    cplCol: "CPL",
    metaLeadsFootnote:
      "“Leads” are the ones Meta counted via the pixel (configured conversion). They may differ from leads recorded in the CRM: the CRM is the source of truth for real leads.",
    metaDailyTrend: "Daily trend",
    metaSpendPerDay: "Spend per day",
    metaLeadsPerDay: "Leads per day",
    metaByDemographic: "By age and gender",
    metaByPlacement: "By ad placement",
    metaWeekOverWeek: "This week vs. last week",
    metaSpendThisWeek: "Spend this week",
    metaCplThisWeek: "CPL this week",
    vsLastWeekAmount: (n) => `vs. ${n} last week`,
    genderMale: "Male",
    genderFemale: "Female",
    genderUnknown: "Unknown",

    leadAcquisition: "Lead acquisition",
    leadsBySourceCampaign: "Leads by source / campaign",
    newLeadsPerDay: "New leads per day (last 30 days)",
    leadsByCity: "Leads by city",

    salesPipeline: "Sales pipeline",
    opportunitiesByStage: "Opportunities by stage (all pipelines)",
    stalledLeads: "Stalled leads",
    stalledSublabel: (open, days) => `of ${open} open, no stage change in ${days}+ days`,
    seeStalledLeads: "See the list",
    opportunitiesByProductLine: "Opportunities by product line",
    lithiumFootnote:
      "The “Litio” (Lithium) stage is a real stage in their pipeline (not an error in this report) — it appears to be used to flag leads specifically interested in lithium batteries, not as a won/lost outcome.",

    responseSpeed: "Response speed",
    responseUnder5min: "Response under 5 min",
    responseUnder1hour: "Response under 1 hour",
    noResponse24h: "No response after 24 hours",

    firstContactFootnote:
      "“Time to first contact” and “Response speed” measure the time between lead creation and the first message a person sends from the CRM or the connected WhatsApp (automated messages don't count). They only include leads since September 28, 2026, when WhatsApp was connected; replies sent outside the CRM aren't visible.",

    viewTable: "View table",
    viewChart: "View chart",
    category: "Category",
    value: "Value",
    leadsOnPrefix: "leads on",

    toggleTheme: "Toggle theme",
    language: "Language",

    crmGroupTitle: "CRM data (GoHighLevel)",
    crmGroupSubtitle: "Leads and opportunities already tracked in the sales team's CRM",
    metaGroupTitle: "Meta Ads data",
    metaGroupSubtitle: "What Meta reports for your paid campaigns — may not match the CRM 1:1",

    tagFilterLabel: "Filter by tag",
    allLeads: "All",
  },
};

export function getDict(lang: Lang): Dict & ExtraDict {
  return { ...dictionaries[lang], ...extraDictionaries[lang] };
}
