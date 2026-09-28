"use client";

import { Select } from "radix-ui";
import { Icon, type IconName } from "@/components/icons";

export type FilterOption = { value: string; label: string; count?: number };

const ALL = "__all__";

/**
 * Dropdown filter. `allLabel` adds a "no filter" option (value null); the
 * trigger is tinted while a filter is active so it's visible at a glance.
 */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
  icon,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  options: FilterOption[];
  allLabel?: string;
  icon?: IconName;
}) {
  const active = allLabel ? value !== null : false;
  const items: FilterOption[] = allLabel ? [{ value: ALL, label: allLabel }, ...options] : options;

  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <Select.Root value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? null : v)}>
        <Select.Trigger
          aria-label={label}
          className="group h-10 w-full min-w-0 rounded-xl px-3 flex items-center gap-2 text-sm text-left outline-none cursor-pointer transition-all hover:border-[var(--baseline)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--series-1)_45%,transparent)] data-[state=open]:ring-2 data-[state=open]:ring-[color-mix(in_srgb,var(--series-1)_45%,transparent)]"
          style={{
            background: active ? "color-mix(in srgb, var(--series-1) 9%, var(--surface-1))" : "var(--surface-1)",
            border: `1px solid ${active ? "color-mix(in srgb, var(--series-1) 45%, transparent)" : "var(--border-hairline)"}`,
            color: "var(--text-primary)",
            boxShadow: "0 1px 2px rgba(11,11,11,0.04)",
          }}
        >
          {icon && <Icon name={icon} size={15} style={{ color: active ? "var(--series-1)" : "var(--text-muted)" }} className="shrink-0" />}
          <span className="flex-1 min-w-0 truncate">
            <Select.Value />
          </span>
          <Select.Icon asChild>
            <Icon
              name="chevronDown"
              size={15}
              className="shrink-0 transition-transform group-data-[state=open]:rotate-180"
              style={{ color: "var(--text-muted)" }}
            />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={6}
            className="z-50 min-w-[var(--radix-select-trigger-width)] max-h-[min(360px,var(--radix-select-content-available-height))] overflow-hidden rounded-xl"
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border-hairline)",
              boxShadow: "0 12px 32px rgba(11,11,11,0.16), 0 2px 6px rgba(11,11,11,0.08)",
            }}
          >
            <Select.Viewport className="p-1.5">
              {items.map((opt) => (
                <Select.Item
                  key={opt.value}
                  value={opt.value}
                  className="relative flex items-center gap-3 rounded-lg pl-8 pr-3 py-2 text-sm outline-none cursor-pointer select-none data-[highlighted]:bg-[color-mix(in_srgb,var(--series-1)_10%,transparent)] data-[state=checked]:font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  <Select.ItemIndicator className="absolute left-2.5 inline-flex" style={{ color: "var(--series-1)" }}>
                    <Icon name="check" size={14} />
                  </Select.ItemIndicator>
                  <Select.ItemText>{opt.label}</Select.ItemText>
                  {opt.count !== undefined && (
                    <span className="ml-auto pl-3 text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
                      {opt.count}
                    </span>
                  )}
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
