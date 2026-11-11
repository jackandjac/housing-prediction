"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { featureLabel, moneyCompact, signedMoney } from "@/lib/format";
import type { Contribution } from "@/lib/types";

/**
 * How much each feature moves this property's price away from the average price.
 * Bars to the right add value; bars to the left remove it.
 */
export function ContributionChart({ contributions }: { contributions: Contribution[] }) {
  const data = contributions.map((c) => ({ name: featureLabel(c.feature), value: c.contribution }));
  const top = [...contributions].sort((a, b) => b.contribution - a.contribution);
  const summary = `Biggest increase: ${featureLabel(top[0].feature)} (${signedMoney(top[0].contribution)}). Biggest decrease: ${featureLabel(top[top.length - 1].feature)} (${signedMoney(top[top.length - 1].contribution)}).`;
  return (
    <figure>
      <div className="h-72 w-full" role="img" aria-label={`Bar chart of price contributions. ${summary}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" tickFormatter={moneyCompact} />
            <YAxis type="category" dataKey="name" width={130} tickLine={false} />
            <ReferenceLine x={0} stroke="var(--muted)" />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              formatter={(v) => [signedMoney(Number(v)), "Effect on price"]}
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
