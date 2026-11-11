"use client";

import { buttonClass } from "@/components/ui/Button";
import { useMarketFilters } from "@/hooks/useMarketFilters";
import { filterParams } from "@/lib/market-filters";

/** Downloads come straight from the Java backend (via the portal proxy) with the current filters and sort. */
export function ExportButtons() {
  const { filters, params } = useMarketFilters();
  const q = filterParams(filters);
  for (const k of ["sort", "dir"]) {
    const v = params.get(k);
    if (v) q.set(k, v);
  }
  const qs = q.size ? `?${q}` : "";
  return (
    <div className="flex gap-2">
      <a href={`/api/market/export.csv${qs}`} download className={buttonClass("secondary", "sm")}>
        Export CSV
      </a>
      <a href={`/api/market/export.pdf${qs}`} download className={buttonClass("secondary", "sm")}>
        Export PDF
      </a>
    </div>
  );
}
