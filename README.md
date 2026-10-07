# Desert Growth

Dashboard de crecimiento y ventas para Desert Growth / MALPA. Combina datos en vivo de **GoHighLevel (GHL)** (CRM/pipeline) y de **Meta Ads** (inversión y rendimiento de campañas), con soporte de tema claro/oscuro e idioma español/inglés. También envía un **reporte diario por correo** con el mes al corte.

**En producción:** https://dashboard.malpa.com.mx (proyecto `malpa/desert-growth` en Vercel, protegido con contraseña)

## Qué hace

- **Dashboard en vivo** (`/`), dividido en dos bloques claramente separados:
  - **Datos del CRM (GoHighLevel):** leads de la semana vs. la anterior, tasa de cierre, mediana de tiempo a primer contacto, leads por fuente/campaña/ciudad y su evolución diaria, oportunidades por etapa y línea de producto, leads "estancados" (14+ días sin moverse), y % de leads respondidos en <5 min / <1 hora / sin respuesta 24h+.
  - **Datos de Meta Ads:** inversión, costo por lead (CPL), CTR, alcance, tendencia diaria de inversión/leads, comparativo semana vs. anterior, desglose por edad/género y por ubicación del anuncio, y tabla de rendimiento por campaña. Es aditivo y a prueba de fallos: si `META_ACCESS_TOKEN` / `META_AD_ACCOUNT_ID` no están configurados, o la API de Meta falla, esta sección muestra un aviso pero el resto del dashboard sigue funcionando igual.
- **Tema claro/oscuro e idioma ES/EN**: se guardan en cookies y cambian al instante (sin recargar datos del CRM/Meta — el toggle solo cambia estado en el navegador).
- **Reporte diario por email** (`app/api/cron/daily-report`): cada mañana manda el mes al corte de ayer (el día 1, el mes que cerró completo), comparado con el mes anterior al mismo día, más lo que pasó ayer. Vía [Resend](https://resend.com) + [React Email](https://react.email). Con `?dry=1` devuelve el HTML sin enviar.
- **Herramientas de export** (`scripts/export-email.mjs`): renderiza la plantilla de email a HTML estático para revisarla sin desplegar ni enviar nada.

## Stack

- [Next.js](https://nextjs.org) 16 (App Router) + React + TypeScript
- Tailwind CSS + [Radix UI](https://www.radix-ui.com/) (switch de tema, selector de idioma)
- [GoHighLevel API](https://highlevel.stoplight.io/) como fuente de datos del CRM/pipeline
- [Meta Graph API (Marketing Insights)](https://developers.facebook.com/docs/marketing-api/insights) como fuente de datos de Meta Ads
- [Resend](https://resend.com) + [React Email](https://react.email) para el envío del reporte diario
- Desplegado en [Vercel](https://vercel.com) (team `malpa`), con el reporte diario y la foto nocturna del pipeline como Vercel Cron Jobs

## Estructura

```
app/
  layout.tsx                   layout raíz, lee cookies de idioma/tema para el <html>
  page.tsx                     server component: junta datos de GHL + Meta y los pasa a <Dashboard>
  api/cron/daily-report/       endpoint del cron que envía el reporte diario
  api/cron/pipeline-snapshot/  cron nocturno: guarda la foto del pipeline y actualiza el historial de etapas
components/
  Dashboard.tsx                 client component: todo el render del dashboard, tema/idioma, agrupación CRM vs. Meta
  BarChart.tsx / LineChart.tsx  gráficas reutilizables (aceptan labels/locale para traducción)
  StatTile.tsx / SectionLabel.tsx  piezas de UI menores
lib/
  ghl.ts                        cliente/consultas a la API de GoHighLevel
  meta.ts                       cliente de Meta Graph API Insights (fail-safe si no está configurado)
  metrics.ts                    cálculo de métricas de negocio a partir de datos crudos de GHL
  i18n.ts                       diccionario de traducciones ES/EN
  client-cookies.ts             helpers para leer/escribir cookies de tema e idioma desde el navegador
emails/
  daily-report.tsx              plantilla del correo diario (React Email)
scripts/
  export-email.mjs              exporta la plantilla de email a HTML para previsualizarla
```

## Desarrollo local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

Para previsualizar las plantillas de email con el editor visual de React Email:

```bash
npm run email
```

## Variables de entorno

Copia estas claves a un `.env.local` (nunca se sube al repo — está en `.gitignore`).

**CRM (GoHighLevel) — requeridas, el dashboard truena sin ellas:**

| Variable | Descripción |
| --- | --- |
| `GHL_PRIVATE_INTEGRATION_TOKEN` | Token de integración privada de GoHighLevel |
| `GHL_LOCATION_ID` | ID de la location/subcuenta de GHL a consultar |
| `REPORT_COMPANY_NAME` | Nombre mostrado en el dashboard y el asunto del correo (soporta `"Partner/Empresa"` para mostrar una alianza) |

**Meta Ads — opcionales; sin ellas esa sección solo muestra un aviso, no rompe nada:**

| Variable | Descripción |
| --- | --- |
| `META_ACCESS_TOKEN` | Token de acceso con permiso `ads_read`. Usar un **System User token** (no expira) — un token de usuario normal dura solo un par de días. |
| `META_AD_ACCOUNT_ID` | ID de la cuenta publicitaria, con o sin el prefijo `act_` |
| `META_API_VERSION` | Versión de la Graph API (default `v21.0`) |
| `META_DATE_PRESET` | Ventana de reporte (default `last_30d`) |
| `META_LEAD_ACTION_TYPE` | Fija el `action_type` exacto a contar como "lead" (ej. `offsite_conversion.custom.<id>`). Si no se define, se suma cualquier `action_type` que contenga "lead". |

**Reporte por correo (Resend):**

| Variable | Descripción |
| --- | --- |
| `RESEND_API_KEY` | API key de Resend |
| `REPORT_RECIPIENTS` | Destinatarios del reporte, separados por coma |
| `REPORT_FROM_EMAIL` | Remitente (opcional; sin dominio verificado se usa `onboarding@resend.dev`, que solo entrega al dueño de la cuenta de Resend) |
| `REPORT_DASHBOARD_URL` | URL del dashboard que se enlaza dentro del correo (default `https://dashboard.malpa.com.mx`) |
| `CRON_SECRET` | Token requerido (`Authorization: Bearer <token>`) por los crons — Vercel lo manda automáticamente; ya configurado en producción |

## Deploy

- Proyecto de Vercel: `malpa/desert-growth`, plan Hobby.
- Cada `git push` a `main` despliega solo (GitHub conectado).
- Crons en `vercel.json` (en Hobby corren en algún momento dentro de la hora): `/api/cron/pipeline-snapshot` a las 06:00 UTC (≈11 pm Hermosillo) y `/api/cron/daily-report` a las 14:00 UTC (≈7 am Hermosillo).

## Pendientes conocidos

- **Resend:** falta conectar Resend (`RESEND_API_KEY`) y `REPORT_RECIPIENTS` en Vercel. Para mandar a cualquier correo hay que verificar un dominio de envío en Resend (registros DNS en Shopify).
- **Acceso de equipo en Vercel:** el plan Hobby no permite invitar miembros al team — si Carlos necesita acceso directo al proyecto de Vercel, hay que pasar a plan Pro.
