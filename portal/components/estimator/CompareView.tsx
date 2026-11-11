"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PriceBars } from "@/components/charts/PriceBars";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Feedback";
import { useCompareSelection } from "@/hooks/useCompareSelection";
import { FEATURE_LABELS, featureLabel, money, signedMoney, featureValue } from "@/lib/format";
import type { Comparison } from "@/lib/types";

/** Side-by-side comparison: price chart plus a feature table with the highest/lowest value per row marked. */
export function CompareView({ comparison }: { comparison: Comparison }) {
  const router = useRouter();
  const { remove } = useCompareSelection();
  const items = comparison.items;
  const names = items.map((e, i) => e.label ?? `Property ${i + 1}`);

  const removeItem = (id: string) => {
    remove(id);
    const rest = items.filter((e) => e.id !== id).map((e) => e.id);
    router.replace(rest.length >= 2 ? `/estimator/compare?ids=${rest.join(",")}` : "/estimator/history");
  };

  return (
    <div className="space-y-6">
      <Card title="Estimated values">
        <PriceBars
          data={items.map((e, i) => ({ id: e.id, name: names[i], value: e.predicted_price }))}
          highlight={(d) => d.id === comparison.most_expensive_id}
          label={`Estimated prices: ${items.map((e, i) => `${names[i]} ${money(e.predicted_price)}`).join(", ")}`}
        />
      </Card>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">Property features side by side</caption>
          <thead className="bg-surface-2 text-xs text-muted uppercase">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">Feature</th>
              {items.map((e, i) => (
                <th key={e.id} scope="col" className="px-3 py-2 text-right font-medium normal-case">
                  <span className="block text-sm text-fg">{names[i]}</span>
                  <span className="mt-1 flex justify-end gap-1">
                    {e.id === comparison.cheapest_id && <Badge tone="positive">Lowest</Badge>}
                    {e.id === comparison.most_expensive_id && <Badge tone="accent">Highest</Badge>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular">
            <tr className="border-t border-line bg-accent-soft/40">
              <th scope="row" className="px-3 py-2 text-left font-semibold">Estimate</th>
              {items.map((e) => (
                <td key={e.id} className="px-3 py-2 text-right font-semibold">
                  {money(e.predicted_price)}
                </td>
              ))}
            </tr>
            {comparison.features.map((f) => {
              const values = items.map((e) => e.inputs[f]);
              const max = Math.max(...values.filter((v) => v != null));
              const min = Math.min(...values.filter((v) => v != null));
              const unit = FEATURE_LABELS[f]?.unit;
              return (
                <tr key={f} className="border-t border-line">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    {featureLabel(f)}
                    {unit && <span className="ml-1 font-normal text-muted">({unit})</span>}
                  </th>
                  {items.map((e) => {
                    const v = e.inputs[f];
                    const c = e.breakdown?.contributions.find((x) => x.feature === f);
                    return (
                      <td key={e.id} className="px-3 py-2 text-right">
                        <span className={max !== min && v === max ? "font-semibold" : undefined}>{v != null ? featureValue(f, v) : "–"}</span>
                        {c && (
                          <span className={`block text-xs ${c.contribution < 0 ? "text-negative" : "text-positive"}`}>
                            {signedMoney(c.contribution)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="border-t border-line">
              <th scope="row" className="px-3 py-2 text-left font-medium text-muted">Model</th>
              {items.map((e) => (
                <td key={e.id} className="px-3 py-2 text-right font-mono text-xs text-muted">
                  {e.model_id}
                </td>
              ))}
            </tr>
            <tr className="border-t border-line">
              <td />
              {items.map((e, i) => (
                <td key={e.id} className="px-3 py-2 text-right">
                  <span className="inline-flex gap-1">
                    <Link href={`/estimator/estimates/${e.id}`} className="text-sm text-accent hover:underline">
                      Details
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => removeItem(e.id)} aria-label={`Remove ${names[i]} from comparison`}>
                      Remove
                    </Button>
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Green and red figures under each value show how much that feature adds to or removes from the estimate,
        relative to the average property.
      </p>
    </div>
  );
}
