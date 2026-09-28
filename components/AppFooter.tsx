import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import type { Dict } from "@/components/AppHeader";

export function AppFooter({ t, children }: { t: Dict; children?: ReactNode }) {
  return (
    <footer className="mt-6" style={{ borderTop: "1px solid var(--border-hairline)" }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-10 py-8 flex flex-col gap-6">
        {children && (
          <div
            className="flex gap-3 rounded-2xl px-4 py-3.5 text-xs leading-relaxed"
            style={{ background: "var(--surface-1)", border: "1px solid var(--border-hairline)", color: "var(--text-secondary)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-px" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <div className="flex flex-col gap-1.5">{children}</div>
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/malpa-logo.png" alt="MALPA" width={80} height={14} className="logo-on-light h-3.5 w-auto opacity-80" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/malpa-logo-white.png" alt="MALPA" width={80} height={14} className="logo-on-dark h-3.5 w-auto opacity-80" />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              © {new Date().getFullYear()}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs" style={{ color: "var(--text-muted)" }}>
            <span>{t.footerSources}</span>
            {["GoHighLevel", "Meta Ads"].map((source) => (
              <span
                key={source}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium"
                style={{ background: "var(--surface-1)", border: "1px solid var(--border-hairline)", color: "var(--text-secondary)" }}
              >
                <Icon name="database" size={12} />
                {source}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
