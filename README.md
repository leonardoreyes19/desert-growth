# Desert Growth

Dashboard de crecimiento y ventas construido sobre datos de **GoHighLevel (GHL)**. Muestra en vivo la adquisición de leads, el pipeline de ventas y la velocidad de respuesta del equipo, y además envía un **reporte semanal por correo** con el mismo resumen.

## Qué hace

- **Dashboard en vivo** (`/`): trae contactos, oportunidades, pipelines y conversaciones de GHL vía su API y calcula métricas de negocio a partir de ellos:
  - leads de la semana vs. la anterior, tasa de cierre, mediana de tiempo a primer contacto
  - leads por fuente/campaña, por ciudad, y su evolución diaria (últimos 30 días)
  - oportunidades por etapa y por línea de producto, y leads "estancados" (sin mover de etapa en 14+ días)
  - % de leads respondidos en <5 min, <1 hora, y sin respuesta después de 24 horas
- **Reporte semanal por email** (`app/api/cron/weekly-report`): un cron job protegido por token que recalcula las mismas métricas y envía un correo (vía [Resend](https://resend.com) + [React Email](https://react.email)) a la lista de destinatarios configurada. Programado en `vercel.json` para correr cada lunes.
- **Herramientas de export** (`scripts/export-email.mjs`): renderiza la plantilla de email a HTML estático para revisarla sin desplegar ni enviar nada.

## Stack

- [Next.js](https://nextjs.org) (App Router) + React + TypeScript
- Tailwind CSS
- [GoHighLevel API](https://highlevel.stoplight.io/) como fuente de datos (CRM/pipeline)
- [Resend](https://resend.com) + [React Email](https://react.email) para el envío del reporte
- Desplegado en [Vercel](https://vercel.com), con el reporte semanal como Vercel Cron Job

## Estructura

```
app/
  page.tsx                     dashboard principal
  api/cron/weekly-report/      endpoint del cron que envía el reporte semanal
components/                    piezas de UI del dashboard (stat tiles, charts, labels)
lib/
  ghl.ts                       cliente/consultas a la API de GoHighLevel
  metrics.ts                   cálculo de métricas a partir de datos crudos de GHL
emails/
  weekly-report.tsx            plantilla del correo semanal (React Email)
scripts/
  export-email.mjs             exporta la plantilla de email a HTML para previsualizarla
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

Copia estas claves a un `.env.local` (no se sube al repo):

| Variable | Descripción |
| --- | --- |
| `GHL_PRIVATE_INTEGRATION_TOKEN` | Token de integración privada de GoHighLevel |
| `GHL_LOCATION_ID` | ID de la location/subcuenta de GHL a consultar |
| `REPORT_COMPANY_NAME` | Nombre mostrado en el dashboard y el asunto del correo (soporta `"Partner/Empresa"` para mostrar una alianza) |
| `RESEND_API_KEY` | API key de Resend para enviar el reporte semanal |
| `REPORT_RECIPIENTS` | Destinatarios del reporte, separados por coma |
| `REPORT_FROM_EMAIL` | Remitente del correo |
| `REPORT_DASHBOARD_URL` | URL del dashboard que se enlaza dentro del correo |
| `CRON_SECRET` | Token requerido (`Authorization: Bearer <token>`) para invocar el cron de reporte semanal |

## Deploy

Pensado para desplegarse en Vercel. El cron semanal está declarado en `vercel.json` (lunes 15:00 UTC) y llama a `/api/cron/weekly-report`, que valida `CRON_SECRET` antes de generar y enviar el correo.
