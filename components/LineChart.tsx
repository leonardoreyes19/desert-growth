"use client";

import { useState } from "react";

export type LineDatum = { date: string; value: number };

const WIDTH = 640;
const HEIGHT = 200;
const PAD_LEFT = 32;
const PAD_BOTTOM = 24;
const PAD_TOP = 12;

export function LineChart({ title, data }: { title: string; data: LineDatum[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const max = Math.max(1, ...data.map((d) => d.value));
  const plotW = WIDTH - PAD_LEFT;
  const plotH = HEIGHT - PAD_BOTTOM - PAD_TOP;
  const stepX = data.length > 1 ? plotW / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    x: PAD_LEFT + i * stepX,
    y: PAD_TOP + plotH - (d.value / max) * plotH,
    ...d,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1]?.x ?? PAD_LEFT},${PAD_TOP + plotH} L${PAD_LEFT},${PAD_TOP + plotH} Z`;

  function handlePointerMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = Math.round((x - PAD_LEFT) / (stepX || 1));
    setHoverIdx(Math.max(0, Math.min(data.length - 1, idx)));
  }

  const gridTicks = 4;
  const hovered = hoverIdx !== null ? points[hoverIdx] : null;

  const maxXLabels = 6;
  const xLabelStep = Math.max(1, Math.ceil(data.length / maxXLabels));
  const xLabels = points.filter((_, i) => i % xLabelStep === 0 || i === points.length - 1);

  return (
    <div
      className="viz-root rounded-2xl p-5 sm:p-6"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border-hairline)", boxShadow: "var(--card-shadow)" }}
    >
      <h3 className="text-sm font-medium mb-4" style={{ color: "var(--text-primary)" }}>
        {title}
      </h3>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        style={{ height: HEIGHT }}
        role="img"
        aria-label={title}
      >
        {Array.from({ length: gridTicks + 1 }).map((_, i) => {
          const y = PAD_TOP + (plotH / gridTicks) * i;
          const value = Math.round(max - (max / gridTicks) * i);
          return (
            <g key={i}>
              <line x1={PAD_LEFT} x2={WIDTH} y1={y} y2={y} stroke="var(--gridline)" strokeWidth={1} />
              <text x={0} y={y + 3} fontSize={10} fill="var(--text-muted)">
                {value}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill="var(--series-1)" opacity={0.1} stroke="none" />
        <path d={linePath} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {xLabels.map((p) => (
          <text
            key={p.date}
            x={p.x}
            y={HEIGHT - 6}
            fontSize={10}
            fill="var(--text-muted)"
            textAnchor={p.x < PAD_LEFT + 20 ? "start" : p.x > WIDTH - 20 ? "end" : "middle"}
          >
            {new Date(p.date + "T00:00:00Z").toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "UTC" })}
          </text>
        ))}

        {hovered && (
          <line
            x1={hovered.x}
            x2={hovered.x}
            y1={PAD_TOP}
            y2={PAD_TOP + plotH}
            stroke="var(--baseline)"
            strokeWidth={1}
          />
        )}
        {hovered && (
          <circle cx={hovered.x} cy={hovered.y} r={4} fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth={2} />
        )}

        <rect
          x={PAD_LEFT}
          y={0}
          width={plotW}
          height={HEIGHT}
          fill="transparent"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverIdx(null)}
        />
      </svg>
      {hovered && (
        <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
          <strong style={{ color: "var(--text-primary)" }}>{hovered.value}</strong> leads el {hovered.date}
        </div>
      )}
    </div>
  );
}
