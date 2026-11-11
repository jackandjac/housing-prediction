"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { EstimateFormOutput } from "@/lib/estimate-schema";
import type { Estimate, EstimatePage } from "@/lib/types";

export const estimateKeys = {
  all: ["estimates"] as const,
  page: (limit: number, offset: number) => ["estimates", "page", limit, offset] as const,
};

/** Submit a property for an estimate; refreshes history on success. */
export function useCreateEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: EstimateFormOutput) =>
      apiFetch<Estimate>("/api/estimator/estimates", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: estimateKeys.all }),
  });
}

/** One page of estimate history. `initialData` comes from the server component's first render. */
export function useEstimateHistory(limit: number, offset: number, initialData?: EstimatePage) {
  return useQuery({
    queryKey: estimateKeys.page(limit, offset),
    queryFn: () => apiFetch<EstimatePage>(`/api/estimator/estimates?limit=${limit}&offset=${offset}`),
    initialData: offset === 0 ? initialData : undefined,
    placeholderData: keepPreviousData,
  });
}

/** Delete with an optimistic update: the row disappears immediately and comes back if the call fails. */
export function useDeleteEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/estimator/estimates/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: estimateKeys.all });
      const snapshot = qc.getQueriesData<EstimatePage>({ queryKey: estimateKeys.all });
      qc.setQueriesData<EstimatePage>({ queryKey: estimateKeys.all }, (page) =>
        page ? { ...page, items: page.items.filter((e) => e.id !== id), total: page.total - 1 } : page,
      );
      return { snapshot };
    },
    onError: (_err, _id, ctx) => ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: () => qc.invalidateQueries({ queryKey: estimateKeys.all }),
  });
}
