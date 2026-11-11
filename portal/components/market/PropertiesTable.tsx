"use client";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { useMarketFilters } from "@/hooks/useMarketFilters";
import { FEATURE_LABELS, featureLabel, money, featureValue } from "@/lib/format";
import type { PropertyPage } from "@/lib/types";

/** Server-sorted, server-paged table. Sort and page live in the URL, so views can be shared. */
export function PropertiesTable({ page, features }: { page: PropertyPage; features: string[] }) {
  const { setParam, setFilters, isPending } = useMarketFilters();
  const columns = ["id", ...features, "price", "price_per_sqft"];
  const pages = Math.max(1, Math.ceil(page.total / page.size));

  if (page.total === 0) {
    return (
      <EmptyState
        title="No properties match these filters"
        action={
          <Button variant="secondary" onClick={() => setFilters({})}>
            Clear filters
          </Button>
        }
      >
        Widen the ranges or clear the filters to see properties again.
      </EmptyState>
    );
  }

  const sortBy = (col: string) =>
    setParam({ sort: col, dir: page.sort === col && page.dir === "desc" ? "asc" : "desc", page: null });

  return (
    <div className="space-y-3">
      <div className={`overflow-x-auto rounded-lg border border-line bg-surface transition-opacity ${isPending ? "opacity-60" : ""}`}>
        <table className="w-full min-w-[880px] text-sm" aria-busy={isPending}>
          <caption className="sr-only">
            Properties sorted by {featureLabel(page.sort)} {page.dir === "asc" ? "ascending" : "descending"}
          </caption>
          <thead className="bg-surface-2 text-xs text-muted uppercase">
            <tr>
              {columns.map((c, i) => {
                const active = page.sort === c;
                const unit = FEATURE_LABELS[c]?.unit;
                return (
                  <th
                    key={c}
                    scope="col"
                    aria-sort={active ? (page.dir === "asc" ? "ascending" : "descending") : "none"}
                    className={`px-3 py-2 font-medium ${i === 0 ? "sticky left-0 bg-surface-2 text-left" : "text-right"}`}
                  >
                    <button
                      type="button"
                      onClick={() => sortBy(c)}
                      className={`inline-flex items-center gap-1 uppercase hover:text-fg ${active ? "text-fg" : ""}`}
                    >
                      {c === "id" ? "ID" : featureLabel(c)}
                      {unit && unit !== "$" && <span className="normal-case">({unit})</span>}
                      <span aria-hidden className="w-3">{active ? (page.dir === "asc" ? "↑" : "↓") : ""}</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="tabular">
            {page.items.map((row) => (
              <tr key={row.id} className="border-t border-line hover:bg-surface-2/50">
                <th scope="row" className="sticky left-0 bg-surface px-3 py-2 text-left font-medium">
                  #{row.id}
                </th>
                {features.map((f) => (
                  <td key={f} className="px-3 py-2 text-right">
                    {row.features[f] != null ? featureValue(f, row.features[f]) : "–"}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-semibold">{money(row.price)}</td>
                <td className="px-3 py-2 text-right">{row.pricePerSqft != null ? money(row.pricePerSqft) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav aria-label="Table pages" className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Button variant="secondary" size="sm" disabled={page.page === 0 || isPending} onClick={() => setParam({ page: String(page.page - 1) })}>
          ← Previous
        </Button>
        <span className="text-muted">
          Page {page.page + 1} of {pages} · {page.total} properties
        </span>
        <Button variant="secondary" size="sm" disabled={page.page >= pages - 1 || isPending} onClick={() => setParam({ page: String(page.page + 1) })}>
          Next →
        </Button>
      </nav>
    </div>
  );
}
