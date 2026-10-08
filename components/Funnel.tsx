"use client";

import { useState } from "react";
import { InfoNote } from "@/components/InfoNote";

export type FunnelDatum = { label: string; hint?: string; count: number; valueLabel?: string };

/**
 * Horizontal funnel: one bar per step, width relative to the largest step, with
 * the step-to-step conversion printed beside it. Single hue — the steps are
 * one measure shrinking, not separate categories.
 */
export function Funnel({
  title,
  steps,
  formatCount,
  ofPrevious,
  note,
}: {
  title: string;
  steps: FunnelDatum[];
  formatCount: (n: number) => string;
  /** Omit when the steps aren't the same leads narrowing down (e.g. a period's activity). */
  ofPrevious?: (pct: string) => string;
  note?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  // Scale to the largest step: in a period's activity a later step can outnumber the first.
  const max = Math.max(1, ...steps.map((s) => s.count));

  return (
    <div
      className="rounded-2xl p-5 sm:p-6"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border-hairline)", boxShadow: "var(--card-shadow)" }}
    >
      <h3 className={`text-sm font-medium ${note ? "mb-1" : "mb-4"}`} style={{ color: "var(--text-primary)" }}>
        {title}
      </h3>
      {note && <InfoNote className="mb-4">{note}</InfoNote>}
      <ol className="flex flex-col gap-3">
        {steps.map((step, i) => {
          const prev = i > 0 ? steps[i - 1].count : null;
          const conv = prev ? step.count / prev : null;
          const pct = (step.count / max) * 100;
          return (
            <li
              key={step.label}
              className="grid items-center gap-3"
              style={{ gridTemplateColumns: "minmax(96px, 150px) 1fr" }}
              onPointerEnter={() => setHovered(i)}
              onPointerLeave={() => setHovered(null)}
            >
              <div className="flex flex-col">
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                  {step.label}
                </span>
                {step.hint && (
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {step.hint}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex-1 min-w-0" style={{ height: 28 }}>
                  <div
                    style={{
                      height: 28,
                      width: `${pct}%`,
                      minWidth: 4,
                      background: "var(--series-1)",
                      borderRadius: "0 4px 4px 0",
                      opacity: hovered === null || hovered === i ? 1 : 0.55,
                      transition: "opacity 120ms ease",
                    }}
                  />
                </div>
                <div className="flex flex-col items-end shrink-0 text-right" style={{ minWidth: 110 }}>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                    {formatCount(step.count)}
                    {step.valueLabel && (
                      <span className="font-normal" style={{ color: "var(--text-secondary)" }}>
                        {" · "}
                        {step.valueLabel}
                      </span>
                    )}
                  </span>
                  {conv !== null && ofPrevious && (
                    <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
                      {ofPrevious(`${Math.round(conv * 100)}%`)}
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
