"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Feedback";
import { useMarketFilters } from "@/hooks/useMarketFilters";
import { FEATURE_LABELS, featureLabel, featureValue } from "@/lib/format";
import { FILTER_COLUMNS, countActive, type MarketFilters } from "@/lib/market-filters";
import type { MarketMeta } from "@/lib/types";

type Draft = Record<string, { min: string; max: string }>;

function toDraft(filters: MarketFilters): Draft {
  const d: Draft = {};
  for (const c of FILTER_COLUMNS) d[c] = { min: filters[c]?.min?.toString() ?? "", max: filters[c]?.max?.toString() ?? "" };
  return d;
}

function fromDraft(d: Draft): MarketFilters {
  const f: MarketFilters = {};
  for (const [c, r] of Object.entries(d)) {
    const min = r.min.trim() === "" ? undefined : Number(r.min);
    const max = r.max.trim() === "" ? undefined : Number(r.max);
    if (min != null || max != null) f[c] = { min, max };
  }
  return f;
}

/**
 * Range filters for market segments. Edits are local until "Apply", which writes them to the URL;
 * server components then re-fetch from the Java backend.
 */
export function FilterBar({ meta }: { meta: MarketMeta }) {
  const { filters, setFilters, isPending } = useMarketFilters();
  const [draft, setDraft] = useState<Draft>(() => toDraft(filters));
  const [open, setOpen] = useState(false);
  const [lastApplied, setLastApplied] = useState(filters);

  // Keep the draft in sync when the URL changes elsewhere (back button, clear).
  if (filters !== lastApplied) {
    setLastApplied(filters);
    setDraft(toDraft(filters));
  }

  const columns = FILTER_COLUMNS.filter((c) => meta.ranges[c]);
  const invalid = columns.filter((c) => {
    const { min, max } = draft[c];
    return min !== "" && max !== "" && Number(min) > Number(max);
  });
  const active = countActive(filters);

  return (
    <form
      className="rounded-[var(--radius-card)] border border-line bg-surface"
      onSubmit={(e) => {
        e.preventDefault();
        if (invalid.length === 0) setFilters(fromDraft(draft));
      }}
      aria-label="Market filters"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-semibold"
          aria-expanded={open}
          aria-controls="filter-fields"
          onClick={() => setOpen((o) => !o)}
        >
          <span aria-hidden className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>›</span>
          Filters
          {active > 0 && <Badge tone="accent">{active} active</Badge>}
        </button>
        <div className="flex items-center gap-2" aria-live="polite">
          {isPending && <span className="text-xs text-muted">Updating…</span>}
          {active > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
              Clear all
            </Button>
          )}
        </div>
      </div>

      <div id="filter-fields" hidden={!open} className="border-t border-line px-4 py-4">
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          {columns.map((c) => {
            const [lo, hi] = meta.ranges[c];
            const unit = FEATURE_LABELS[c]?.unit;
            const bad = invalid.includes(c);
            return (
              <fieldset key={c} className="min-w-0">
                <legend className="mb-1.5 text-sm font-medium">
                  {featureLabel(c)}
                  {unit && <span className="ml-1 font-normal text-muted">({unit})</span>}
                </legend>
                <div className="flex items-center gap-2">
                  {(["min", "max"] as const).map((k) => (
                    <input
                      key={k}
                      type="number"
                      inputMode="decimal"
                      aria-label={`${featureLabel(c)} ${k === "min" ? "minimum" : "maximum"}`}
                      aria-invalid={bad || undefined}
                      placeholder={featureValue(c, k === "min" ? lo : hi)}
                      value={draft[c][k]}
                      onChange={(e) => setDraft((d) => ({ ...d, [c]: { ...d[c], [k]: e.target.value } }))}
                      className={`h-9 w-full min-w-0 rounded-lg border bg-surface px-2 text-sm tabular ${bad ? "border-negative" : "border-line"}`}
                    />
                  ))}
                </div>
                {bad && <p className="mt-1 text-xs text-negative">Minimum is above maximum</p>}
              </fieldset>
            );
          })}
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit" size="sm" disabled={invalid.length > 0 || isPending}>
            Apply filters
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setDraft(toDraft(filters))}>
            Undo changes
          </Button>
        </div>
      </div>
    </form>
  );
}
