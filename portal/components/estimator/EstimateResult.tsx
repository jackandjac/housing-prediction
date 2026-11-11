"use client";

import Link from "next/link";
import { ContributionChart } from "@/components/charts/ContributionChart";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Feedback";
import { MAX_COMPARE, useCompareSelection } from "@/hooks/useCompareSelection";
import { FEATURE_LABELS, dateTime, featureLabel, money, signedMoney, featureValue } from "@/lib/format";
import type { Estimate } from "@/lib/types";

/** An estimate as a table (inputs, market average, effect on price) and a chart. */
export function EstimateResult({ estimate }: { estimate: Estimate }) {
  const { ids, toggle } = useCompareSelection();
  const selected = ids.includes(estimate.id);
  const contributions = estimate.breakdown?.contributions ?? [];
  const byFeature = new Map(contributions.map((c) => [c.feature, c]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted">{estimate.label ?? "Estimated value"}</p>
          <p className="text-4xl font-semibold tracking-tight tabular" aria-live="polite">
            {money(estimate.predicted_price)}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            <Badge tone="accent">{estimate.model_type ?? "model"}</Badge>
            <span className="font-mono">{estimate.model_id}</span>
            <span>· {dateTime(estimate.created_at)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toggle(estimate.id)}
            disabled={!selected && ids.length >= MAX_COMPARE}
            aria-pressed={selected}
          >
            {selected ? "✓ In comparison" : "Add to comparison"}
          </Button>
          {ids.length >= 2 && (
            <Link href={`/estimator/compare?ids=${ids.join(",")}`} className="inline-flex h-8 items-center text-sm font-medium text-accent hover:underline">
              Compare {ids.length} →
            </Link>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[480px] text-sm">
          <caption className="sr-only">Property details and their effect on the estimate</caption>
          <thead className="bg-surface-2 text-left text-xs text-muted uppercase">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Feature</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">This property</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Market average</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Effect on price</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {Object.entries(estimate.inputs).map(([name, value]) => {
              const c = byFeature.get(name);
              const unit = FEATURE_LABELS[name]?.unit;
              return (
                <tr key={name} className="border-t border-line">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    {featureLabel(name)}
                    {unit && <span className="ml-1 font-normal text-muted">({unit})</span>}
                  </th>
                  <td className="px-3 py-2 text-right">{featureValue(name, value)}</td>
                  <td className="px-3 py-2 text-right text-muted">{c ? featureValue(name, c.average) : "–"}</td>
                  <td className={`px-3 py-2 text-right font-medium ${c && c.contribution < 0 ? "text-negative" : "text-positive"}`}>
                    {c ? signedMoney(c.contribution) : "–"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {estimate.breakdown && (
            <tfoot className="tabular">
              <tr className="border-t border-line text-muted">
                <th scope="row" colSpan={3} className="px-3 py-2 text-left font-normal">
                  Average price in the training data
                </th>
                <td className="px-3 py-2 text-right">{money(estimate.breakdown.baseline)}</td>
              </tr>
              <tr className="border-t border-line">
                <th scope="row" colSpan={3} className="px-3 py-2 text-left">
                  Estimated value
                </th>
                <td className="px-3 py-2 text-right font-semibold">{money(estimate.predicted_price)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {contributions.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold">What drives this price</h3>
          <ContributionChart contributions={contributions} />
        </div>
      ) : (
        <p className="text-sm text-muted">This model doesn’t provide a price breakdown.</p>
      )}
    </div>
  );
}
