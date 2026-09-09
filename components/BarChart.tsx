"use client";

import { useId, useState } from "react";

export type BarDatum = { label: string; value: number };

export function BarChart({
  title,
  data,
  formatValue = (n: number) => n.toLocaleString("es-MX"),
  valueSuffix,
}: {
  title: string;
  data: BarDatum[];
  formatValue?: (n: number) => string;
  valueSuffix?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div
      className="viz-root rounded-2xl p-5 sm:p-6"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border-hairline)", boxShadow: "var(--card-shadow)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {title}
        </h3>
        <button
          onClick={() => setShowTable((v) => !v)}
          className="text-xs underline"
          style={{ color: "var(--text-muted)" }}
          aria-expanded={showTable}
          aria-controls={tableId}
        >
          {showTable ? "Ver gráfica" : "Ver tabla"}
        </button>
      </div>

      {showTable ? (
        <table id={tableId} className="w-full text-sm">
          <thead>
            <tr style={{ color: "var(--text-secondary)" }}>
              <th className="text-left font-normal pb-2">Categoría</th>
              <th className="text-right font-normal pb-2">Valor</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label} style={{ borderTop: "1px solid var(--gridline)" }}>
                <td className="py-1.5" style={{ color: "var(--text-primary)" }}>
                  {d.label}
                </td>
                <td className="py-1.5 text-right" style={{ color: "var(--text-primary)" }}>
                  {formatValue(d.value)}
                  {valueSuffix}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div id={tableId} className="flex flex-col gap-2.5">
          {data.map((d, i) => {
            const pct = (d.value / max) * 100;
            const isHovered = hovered === i;
            return (
              <div
                key={d.label}
                className="grid items-center gap-3 relative"
                style={{ gridTemplateColumns: "128px 1fr auto" }}
                onPointerEnter={() => setHovered(i)}
                onPointerLeave={() => setHovered(null)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
                tabIndex={0}
              >
                <span
                  className="text-sm truncate"
                  style={{ color: "var(--text-secondary)" }}
                  title={d.label}
                >
                  {d.label}
                </span>
                <div className="relative" style={{ height: 20 }}>
                  <div
                    style={{
                      height: 20,
                      width: `${pct}%`,
                      minWidth: 4,
                      background: "var(--series-1)",
                      borderRadius: "0 4px 4px 0",
                      opacity: isHovered ? 1 : 0.92,
                      transition: "opacity 120ms ease",
                    }}
                  />
                  {isHovered && (
                    <div
                      role="tooltip"
                      className="absolute z-10 rounded-md px-2 py-1 text-xs shadow-lg whitespace-nowrap"
                      style={{
                        left: `calc(${pct}% + 8px)`,
                        top: -2,
                        background: "var(--text-primary)",
                        color: "var(--surface-1)",
                      }}
                    >
                      <strong>{formatValue(d.value)}{valueSuffix}</strong>{" "}
                      <span style={{ opacity: 0.75 }}>{d.label}</span>
                    </div>
                  )}
                </div>
                <span className="text-sm text-right tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {formatValue(d.value)}
                  {valueSuffix}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
