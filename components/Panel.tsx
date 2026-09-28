import type { ReactNode } from "react";

export function Panel({ title, subtitle, children }: { title?: string; subtitle?: string; children: ReactNode }) {
  return (
    <div
      className="rounded-2xl p-5 sm:p-6 overflow-x-auto"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border-hairline)", boxShadow: "var(--card-shadow)" }}
    >
      {title && (
        <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {title}
        </h3>
      )}
      {subtitle && (
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          {subtitle}
        </p>
      )}
      <div className={title || subtitle ? "mt-4" : undefined}>{children}</div>
    </div>
  );
}

export function Th({ children, align = "right" }: { children: ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`font-normal pb-2 whitespace-nowrap ${align === "left" ? "text-left pr-3" : "text-right pl-3"}`}>
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "right",
  strong = false,
}: {
  children: ReactNode;
  align?: "left" | "right";
  strong?: boolean;
}) {
  return (
    <td
      className={`py-2 ${align === "left" ? "text-left pr-3" : "text-right pl-3 tabular-nums whitespace-nowrap"}`}
      style={{ color: strong ? "var(--text-primary)" : "var(--text-secondary)" }}
    >
      {children}
    </td>
  );
}
