"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";
import { parseFilters, withFilters, type MarketFilters } from "@/lib/market-filters";

/**
 * Market filters synced with the URL. Updating them navigates (in a transition), so the
 * server components re-fetch with the new filters while the current view stays visible.
 */
export function useMarketFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const filters = useMemo(() => parseFilters(params), [params]);

  const navigate = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [pathname, router],
  );

  const setFilters = useCallback(
    (next: MarketFilters) => navigate(withFilters(new URLSearchParams(params), next)),
    [navigate, params],
  );

  /** Set or clear a single non-filter param (sort, dir, page, groupBy). */
  const setParam = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params);
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === "") next.delete(k);
        else next.set(k, v);
      }
      navigate(next);
    },
    [navigate, params],
  );

  return { filters, params, setFilters, setParam, isPending };
}
