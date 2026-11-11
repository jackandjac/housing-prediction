"use client";

import { useEffect, useRef, useState } from "react";
import { WhatIfChart } from "@/components/charts/MarketCharts";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Select } from "@/components/ui/Field";
import { Alert, Badge, EmptyState, Skeleton } from "@/components/ui/Feedback";
import { useWhatIf } from "@/hooks/useWhatIf";
import { ApiError } from "@/lib/errors";
import { FEATURE_LABELS, featureLabel, money, number, signedMoney, featureValue } from "@/lib/format";
import type { MarketMeta, WhatIfRequest } from "@/lib/types";

const INTEGER = new Set(["bedrooms", "year_built"]);
const round = (f: string, v: number) => (INTEGER.has(f) ? Math.round(v) : Math.round(v * 10) / 10);

/**
 * Pick a base property, choose one feature to vary over a range, and see how the model's price responds.
 * Runs on the Java backend, which makes one batch call to the ML model and caches the result per model.
 */
export function WhatIfTool({ meta, averages }: { meta: MarketMeta; averages: Record<string, number> }) {
  const features = meta.features;
  const [base, setBase] = useState<Record<string, string>>(() =>
    Object.fromEntries(features.map((f) => [f, String(round(f, averages[f] ?? meta.ranges[f]?.[0] ?? 0))])),
  );
  const [vary, setVary] = useState(features.includes("square_footage") ? "square_footage" : features[0]);
  const [range, setRange] = useState(() => ({ from: String(meta.ranges[vary][0]), to: String(meta.ranges[vary][1]) }));
  const [steps, setSteps] = useState("11");
  const whatIf = useWhatIf();
  const ran = useRef(false);

  const request = (): WhatIfRequest | string => {
    const b: Record<string, number> = {};
    for (const f of features) {
      const v = Number(base[f]);
      if (base[f].trim() === "" || !Number.isFinite(v)) return `${featureLabel(f)} needs a number.`;
      b[f] = v;
    }
    const from = Number(range.from);
    const to = Number(range.to);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return "Enter a start and end value.";
    if (from >= to) return "The start value must be lower than the end value.";
    return { base: b, vary, from, to, steps: Number(steps) };
  };

  const run = () => {
    const r = request();
    if (typeof r !== "string") whatIf.mutate(r);
  };
  const validation = request();

  // Open in a working state: analyse the average property once on first render.
  useEffect(() => {
    if (!ran.current) {
      ran.current = true;
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const result = whatIf.data;
  const unit = FEATURE_LABELS[vary]?.unit;
  const first = result?.points[0];
  const last = result?.points[result.points.length - 1];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
      <Card title="Scenario" description="Starts from the average property in the dataset.">
        <form
          className="space-y-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm font-semibold">Vary</legend>
            <Select
              id="vary"
              label="Feature"
              value={vary}
              onChange={(e) => {
                const f = e.target.value;
                setVary(f);
                setRange({ from: String(meta.ranges[f][0]), to: String(meta.ranges[f][1]) });
              }}
            >
              {features.map((f) => (
                <option key={f} value={f}>
                  {featureLabel(f)}
                </option>
              ))}
            </Select>
            <div className="grid grid-cols-3 gap-3">
              <Field id="from" label="From" type="number" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
              <Field id="to" label="To" type="number" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
              <Field id="steps" label="Points" type="number" min={2} max={50} value={steps} onChange={(e) => setSteps(e.target.value)} />
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Base property</legend>
            <div className="grid grid-cols-2 gap-3">
              {features.map((f) => (
                <Field
                  key={f}
                  id={`base-${f}`}
                  label={featureLabel(f)}
                  unit={FEATURE_LABELS[f]?.unit}
                  type="number"
                  value={base[f]}
                  disabled={f === vary}
                  hint={f === vary ? "Varied" : undefined}
                  onChange={(e) => setBase((b) => ({ ...b, [f]: e.target.value }))}
                />
              ))}
            </div>
          </fieldset>

          {typeof validation === "string" && <p className="text-sm text-negative">{validation}</p>}
          <Button type="submit" disabled={whatIf.isPending || typeof validation === "string"}>
            {whatIf.isPending ? "Running…" : "Run analysis"}
          </Button>
        </form>
      </Card>

      <Card
        title={`Predicted price by ${featureLabel(vary).toLowerCase()}`}
        action={
          result && (
            <div className="flex items-center gap-2">
              <Badge tone={result.cached ? "positive" : "neutral"}>{result.cached ? "Served from cache" : "Freshly computed"}</Badge>
              <span className="font-mono text-xs text-muted">{result.modelId}</span>
            </div>
          )
        }
      >
        {whatIf.error ? (
          <Alert title="The analysis didn’t run">
            {whatIf.error.message}
            {whatIf.error instanceof ApiError && whatIf.error.errors.length > 1 && (
              <ul className="mt-1 list-disc pl-5">
                {whatIf.error.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </Alert>
        ) : !result ? (
          whatIf.isPending ? <Skeleton className="h-80 w-full" /> : <EmptyState title="Run an analysis to see the curve" />
        ) : (
          <div className={`space-y-4 ${whatIf.isPending ? "opacity-60" : ""}`}>
            {first && last && (
              <p className="text-sm" aria-live="polite">
                Going from {number(first.value)} to {number(last.value)}
                {unit ? ` ${unit}` : ""} changes the predicted price from <strong>{money(first.price)}</strong> to{" "}
                <strong>{money(last.price)}</strong> ({signedMoney(last.price - first.price)}). The base property is valued at{" "}
                {money(result.basePrice)}.
              </p>
            )}
            <WhatIfChart result={result} unit={unit} />
            <details className="text-sm">
              <summary className="cursor-pointer font-medium">Show values</summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[360px]">
                  <caption className="sr-only">What-if values</caption>
                  <thead className="text-left text-xs text-muted uppercase">
                    <tr>
                      <th scope="col" className="py-1.5 font-medium">{featureLabel(vary)}</th>
                      <th scope="col" className="py-1.5 text-right font-medium">Predicted price</th>
                      <th scope="col" className="py-1.5 text-right font-medium">vs base</th>
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    {result.points.map((p) => (
                      <tr key={p.value} className="border-t border-line">
                        <td className="py-1.5">{featureValue(vary, p.value)}</td>
                        <td className="py-1.5 text-right">{money(p.price)}</td>
                        <td className={`py-1.5 text-right ${p.delta < 0 ? "text-negative" : "text-positive"}`}>{signedMoney(p.delta)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        )}
      </Card>
    </div>
  );
}
