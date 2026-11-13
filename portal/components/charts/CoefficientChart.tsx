"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { featureLabel, moneyCompact, signedMoney } from "@/lib/format";

/**
 * Standardized coefficients: price change for a one-standard-deviation increase in each
 * feature, so features with different units can be compared.
 */
export function CoefficientChart({ coefficients }: { coefficients: Record<string, number> }) {
  const data = Object.entries(coefficients)
    .map(([f, v]) => ({ name: featureLabel(f), value: v }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const top = data[0];
  const summary = top ? `Strongest effect: ${top.name} (${signedMoney(top.value)} per standard deviation).` : "";
  return (
    <figure>
      <div className="h-72 w-full" role="img" aria-label={`Bar chart of standardized coefficients. ${summary}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" tickFormatter={moneyCompact} />
            <YAxis type="category" dataKey="name" width={150} tickLine={false} />
            <ReferenceLine x={0} stroke="var(--muted)" />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              formatter={(v) => [signedMoney(Number(v)), "Per standard deviation"]}
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8 }}
              labelStyle={{ color: "var(--fg)" }}
            />
            <Bar dataKey="value" radius={4} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.value >= 0 ? "var(--positive)" : "var(--negative)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 text-xs text-muted">{summary}</figcaption>
    </figure>
  );
}
