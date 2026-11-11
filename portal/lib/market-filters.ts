/**
 * Market filters live in the URL (shareable, bookmarkable, back-button friendly) using the
 * market-api convention: <column>.min / <column>.max.
 */
export type RangeFilter = { min?: number; max?: number };
export type MarketFilters = Record<string, RangeFilter>;

/** Columns offered in the filter bar, in display order. */
export const FILTER_COLUMNS = ["price", "bedrooms", "bathrooms", "square_footage", "year_built", "school_rating", "distance_to_city_center"] as const;

type ParamsLike = { get(name: string): string | null; forEach(cb: (value: string, key: string) => void): void };

export function parseFilters(params: ParamsLike): MarketFilters {
  const filters: MarketFilters = {};
  params.forEach((value, key) => {
    const m = /^(.+)\.(min|max)$/.exec(key);
    if (!m || value.trim() === "") return;
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    (filters[m[1]] ??= {})[m[2] as "min" | "max"] = n;
  });
  return filters;
}

/** Only the filter params (drops sort, page, groupBy, ...), in a stable order. */
export function filterParams(filters: MarketFilters): URLSearchParams {
  const p = new URLSearchParams();
  for (const col of Object.keys(filters).sort()) {
    const r = filters[col];
    if (r.min != null) p.set(`${col}.min`, String(r.min));
    if (r.max != null) p.set(`${col}.max`, String(r.max));
  }
  return p;
}

/** Replace the filter part of a query string, keeping other params (sort, groupBy) but resetting page. */
export function withFilters(current: URLSearchParams, filters: MarketFilters): URLSearchParams {
  const next = new URLSearchParams();
  current.forEach((v, k) => {
    if (!/\.(min|max)$/.test(k) && k !== "page") next.set(k, v);
  });
  filterParams(filters).forEach((v, k) => next.set(k, v));
  return next;
}

export function countActive(filters: MarketFilters): number {
  return Object.values(filters).filter((r) => r.min != null || r.max != null).length;
}

/** Convert a Next.js searchParams object to URLSearchParams. */
export function toSearchParams(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) v.forEach((x) => p.append(k, x));
    else if (v != null) p.set(k, v);
  }
  return p;
}
