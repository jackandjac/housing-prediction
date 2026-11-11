"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { money, moneyCompact } from "@/lib/format";

/** Vertical bars of prices; the highlighted bar uses the accent colour. */
export function PriceBars({
  data,
  highlight,
  label,
  height = "h-64",
}: {
  data: { name: string; value: number; id?: string }[];
  highlight?: (d: { name: string; value: number; id?: string }) => boolean;
  label: string;
  height?: string;
}) {
  return (
    <div className={`${height} w-full`} role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 24, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="name" tickLine={false} interval={0} />
          <YAxis tickFormatter={moneyCompact} width={64} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            formatter={(v) => [money(Number(v)), "Price"]}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8 }}
            labelStyle={{ color: "var(--fg)" }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            <LabelList dataKey="value" position="top" formatter={(v) => moneyCompact(Number(v))} className="tabular" />
            {data.map((d) => (
              <Cell key={d.id ?? d.name} fill={highlight?.(d) ? "var(--chart-1)" : "var(--chart-2)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
