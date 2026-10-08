import type { ReactNode } from "react";

/**
 * Small always-visible note under a number or chart that spells out what it
 * counts and its exceptions (so nobody has to ask how it's calculated).
 */
export function InfoNote({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-[11px] leading-snug flex gap-1.5 ${className}`} style={{ color: "var(--text-muted)" }}>
      <span aria-hidden className="shrink-0 font-semibold" style={{ color: "var(--series-1)" }}>
        ⓘ
      </span>
      <span>{children}</span>
    </p>
  );
}
