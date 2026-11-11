"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { featureLabel, money, moneyCompact, number, signedMoney, featureValue } from "@/lib/format";
import type { Correlation, Distribution, ModelFit, WhatIfResult } from "@/lib/types";

const tooltip = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8 },
  labelStyle: { color: "var(--fg)" },
  cursor: { fill: "var(--surface-2)" },
};

export function HistogramChart({ distribution }: { distribution: Distribution }) {
  const data = distribution.bins.map((b) => ({ name: `${moneyCompact(b.from)}–${moneyCompact(b.to)}`, count: b.count }));
  return (
    <div className="h-64 w-full" role="img" aria-label={`Price distribution: ${data.map((d) => `${d.name}: ${d.count}`).join("; ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="name" tickLine={false} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} width={32} />
          <Tooltip {...tooltip} formatter={(v) => [v, "Properties"]} />
          <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CorrelationChart({ correlations }: { correlations: Correlation[] }) {
  const data = correlations.map((c) => ({ name: featureLabel(c.feature), r: c.r }));
  return (
    <div className="h-64 w-full" role="img" aria-label={`Correlation with price: ${data.map((d) => `${d.name} ${d.r}`).join("; ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" domain={[-1, 1]} ticks={[-1, -0.5, 0, 0.5, 1]} />
          <YAxis type="category" dataKey="name" width={130} tickLine={false} />
          <ReferenceLine x={0} stroke="var(--muted)" />
          <Tooltip {...tooltip} formatter={(v) => [Number(v).toFixed(3), "Correlation (r)"]} />
          <Bar dataKey="r" fill="var(--chart-1)" radius={4} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ModelFitChart({ fit }: { fit: ModelFit }) {
  const values = fit.points.flatMap((p) => [p.actual, p.predicted]);
  const lo = Math.floor(Math.min(...values) / 25000) * 25000;
  const hi = Math.ceil(Math.max(...values) / 25000) * 25000;
  return (
    <div className="h-72 w-full" role="img" aria-label={`Predicted versus recorded price for ${fit.count} properties; average error ${money(fit.mae)}.`}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 16, bottom: 16, left: 8 }}>
          <CartesianGrid />
          <XAxis type="number" dataKey="actual" name="Recorded" domain={[lo, hi]} tickFormatter={moneyCompact} label={{ value: "Recorded price", position: "insideBottom", offset: -8 }} />
          <YAxis type="number" dataKey="predicted" name="Predicted" domain={[lo, hi]} tickFormatter={moneyCompact} width={64} />
          <ZAxis range={[40, 40]} />
          <ReferenceLine segment={[{ x: lo, y: lo }, { x: hi, y: hi }]} stroke="var(--muted)" strokeDasharray="4 4" />
          <Tooltip {...tooltip} cursor={{ strokeDasharray: "3 3" }} formatter={(v, n) => [money(Number(v)), n]} />
          <Scatter data={fit.points} fill="var(--chart-1)" isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WhatIfChart({ result, unit }: { result: WhatIfResult; unit?: string }) {
  const label = featureLabel(result.vary);
  return (
    <div
      className="h-80 w-full"
      role="img"
      aria-label={`Predicted price as ${label} goes from ${number(result.points[0].value)} to ${number(result.points[result.points.length - 1].value)}: ${money(result.points[0].price)} to ${money(result.points[result.points.length - 1].price)}.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={result.points} margin={{ top: 16, right: 16, bottom: 16, left: 8 }}>
          <CartesianGrid />
          <XAxis
            type="number"
            dataKey="value"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v) => featureValue(result.vary, v)}
            label={{ value: unit ? `${label} (${unit})` : label, position: "insideBottom", offset: -8 }}
          />
          <YAxis tickFormatter={moneyCompact} width={64} domain={["auto", "auto"]} />
          <Tooltip
            {...tooltip}
            cursor={{ stroke: "var(--line)" }}
            labelFormatter={(v) => `${label}: ${featureValue(result.vary, Number(v))}`}
            formatter={(v, _n, item) => [`${money(Number(v))} (${signedMoney(item.payload.delta)})`, "Predicted price"]}
          />
          <Line type="monotone" dataKey="price" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          <ReferenceDot x={result.baseValue} y={result.basePrice} r={6} fill="var(--fg)" stroke="var(--surface)" label={{ value: "Base", position: "top" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
