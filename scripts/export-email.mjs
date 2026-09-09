import { render } from "react-email";
import React from "react";
import { WeeklyReport } from "../emails/weekly-report.tsx";
import fs from "fs";

const html = await render(React.createElement(WeeklyReport, WeeklyReport.PreviewProps));
fs.mkdirSync("exports/emails", { recursive: true });
fs.writeFileSync("exports/emails/weekly-report.html", html);
console.log("wrote exports/emails/weekly-report.html", html.length, "bytes");
