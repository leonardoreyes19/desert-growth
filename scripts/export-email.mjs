import { render } from "react-email";
import React from "react";
import DailyReport from "../emails/daily-report.tsx";
import fs from "fs";

const html = await render(React.createElement(DailyReport, DailyReport.PreviewProps));
fs.mkdirSync("exports/emails", { recursive: true });
fs.writeFileSync("exports/emails/daily-report.html", html);
console.log("wrote exports/emails/daily-report.html", html.length, "bytes");
