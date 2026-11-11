"use client";

import { PriceBars } from "@/components/charts/PriceBars";
import { Select } from "@/components/ui/Field";
import { useMarketFilters } from "@/hooks/useMarketFilters";
import { featureLabel, money } from "@/lib/format";
import type { Segments } from "@/lib/types";

const GROUP_LABELS: Record<string, string> = {
  bedrooms: "Bedrooms",
  bathrooms: "Bathrooms",
  decade: "Decade built",
  school_band: "School rating",
  distance_band: "Distance to center",
};

/** Median price per segment, with the grouping kept in the URL (?groupBy=). */
export function SegmentPanel({ segments, options }: { segments: Segments; options: string[] }) {
  const { setParam, isPending } = useMarketFilters();
  return (
    <div className="space-y-4">
      <Select
        id="group-by"
        label="Group by"
        value={segments.groupBy}
        onChange={(e) => setParam({ groupBy: e.target.value })}
        className="max-w-xs"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {GROUP_LABELS[o] ?? featureLabel(o)}
          </option>
        ))}
      </Select>
      <div className={isPending ? "opacity-60 transition-opacity" : undefined}>
        {segments.segments.length === 0 ? (
          <p className="text-sm text-muted">No properties match the filters.</p>
        ) : (
          <>
            <PriceBars
              data={segments.segments.map((s) => ({ name: s.label, value: s.medianPrice }))}
              highlight={() => true}
              label={`Median price by ${GROUP_LABELS[segments.groupBy]}: ${segments.segments.map((s) => `${s.label} ${money(s.medianPrice)}`).join(", ")}`}
            />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <caption className="sr-only">Segment statistics</caption>
                <thead className="text-left text-xs text-muted uppercase">
                  <tr>
                    <th scope="col" className="py-1.5 pr-3 font-medium">Segment</th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-medium">Count</th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-medium">Median</th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-medium">Range</th>
                    <th scope="col" className="py-1.5 text-right font-medium">$ / sq ft</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {segments.segments.map((s) => (
                    <tr key={s.key} className="border-t border-line">
                      <th scope="row" className="py-1.5 pr-3 text-left font-medium">{s.label}</th>
                      <td className="py-1.5 pr-3 text-right">{s.count}</td>
                      <td className="py-1.5 pr-3 text-right">{money(s.medianPrice)}</td>
                      <td className="py-1.5 pr-3 text-right text-muted">
                        {money(s.minPrice)}–{money(s.maxPrice)}
                      </td>
                      <td className="py-1.5 text-right">{s.medianPricePerSqft != null ? money(s.medianPricePerSqft) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
