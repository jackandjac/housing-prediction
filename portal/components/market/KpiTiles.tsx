import { Stat } from "@/components/ui/Feedback";
import { money, moneyCompact } from "@/lib/format";
import type { MarketSummary } from "@/lib/types";

export function KpiTiles({ summary }: { summary: MarketSummary }) {
  const p = summary.price;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Properties" value={summary.count} sub={`of ${summary.totalProperties} in the dataset`} />
      <Stat label="Median price" value={p ? money(p.median) : "–"} sub={p ? `Mean ${money(p.mean)}` : undefined} />
      <Stat
        label="Price range"
        value={p ? `${moneyCompact(p.min)}–${moneyCompact(p.max)}` : "–"}
        sub={p ? `Middle half ${moneyCompact(p.p25)}–${moneyCompact(p.p75)}` : undefined}
      />
      <Stat
        label="Median $ / sq ft"
        value={summary.pricePerSqft ? money(summary.pricePerSqft.median) : "–"}
        sub={summary.pricePerSqft ? `Range ${money(summary.pricePerSqft.min)}–${money(summary.pricePerSqft.max)}` : undefined}
      />
    </div>
  );
}
