"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Alert, EmptyState } from "@/components/ui/Feedback";
import { MAX_COMPARE, useCompareSelection } from "@/hooks/useCompareSelection";
import { useDeleteEstimate, useEstimateHistory } from "@/hooks/useEstimates";
import { errorMessage } from "@/lib/errors";
import { dateTime, money, number } from "@/lib/format";
import type { EstimatePage } from "@/lib/types";

const PAGE_SIZE = 10;

export function HistoryTable({ initialData }: { initialData: EstimatePage }) {
  const [page, setPage] = useState(0);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const history = useEstimateHistory(PAGE_SIZE, page * PAGE_SIZE, initialData);
  const remove = useDeleteEstimate();
  const { ids, toggle, remove: unselect } = useCompareSelection();

  const data = history.data;
  if (!data) return null;
  if (data.total === 0) {
    return (
      <EmptyState title="No estimates yet" action={<ButtonLink href="/estimator">Get your first estimate</ButtonLink>}>
        Every estimate you make is saved here so you can revisit and compare them.
      </EmptyState>
    );
  }
  const pages = Math.ceil(data.total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {remove.error && <Alert title="Couldn’t delete the estimate">{errorMessage(remove.error)}</Alert>}
      {history.error && <Alert title="Couldn’t refresh history">{errorMessage(history.error)}</Alert>}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-accent-soft px-4 py-3 text-sm" aria-live="polite">
        <span>
          {ids.length === 0
            ? `Select up to ${MAX_COMPARE} estimates to compare them side by side.`
            : `${ids.length} of ${MAX_COMPARE} selected for comparison.`}
        </span>
        <div className="flex gap-2">
          {ids.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => useCompareSelection.getState().clear()}>
              Clear
            </Button>
          )}
          <ButtonLink
            href={`/estimator/compare?ids=${ids.join(",")}`}
            size="sm"
            aria-disabled={ids.length < 2}
            className={ids.length < 2 ? "pointer-events-none opacity-50" : undefined}
            tabIndex={ids.length < 2 ? -1 : undefined}
          >
            Compare
          </ButtonLink>
        </div>
      </div>

      <div className={`overflow-x-auto rounded-lg border border-line transition-opacity ${history.isFetching ? "opacity-70" : ""}`}>
        <table className="w-full min-w-[720px] text-sm">
          <caption className="sr-only">Estimate history, newest first</caption>
          <thead className="bg-surface-2 text-left text-xs text-muted uppercase">
            <tr>
              <th scope="col" className="w-10 px-3 py-2">
                <span className="sr-only">Compare</span>
              </th>
              <th scope="col" className="px-3 py-2 font-medium">Property</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Living area</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Beds / baths</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Estimate</th>
              <th scope="col" className="px-3 py-2 font-medium">Created</th>
              <th scope="col" className="px-3 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="tabular">
            {data.items.map((e) => {
              const checked = ids.includes(e.id);
              const name = e.label ?? `${number(e.inputs.square_footage ?? 0)} sq ft property`;
              return (
                <tr key={e.id} className="border-t border-line hover:bg-surface-2/50">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--accent)]"
                      checked={checked}
                      disabled={!checked && ids.length >= MAX_COMPARE}
                      onChange={() => toggle(e.id)}
                      aria-label={`Compare ${name}`}
                    />
                  </td>
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    <Link href={`/estimator/estimates/${e.id}`} className="hover:text-accent hover:underline">
                      {name}
                    </Link>
                  </th>
                  <td className="px-3 py-2 text-right">{e.inputs.square_footage != null ? number(e.inputs.square_footage) : "–"}</td>
                  <td className="px-3 py-2 text-right">
                    {e.inputs.bedrooms ?? "–"} / {e.inputs.bathrooms ?? "–"}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">{money(e.predicted_price)}</td>
                  <td className="px-3 py-2 text-muted">{dateTime(e.created_at)}</td>
                  <td className="px-3 py-2 text-right">
                    {confirmId === e.id ? (
                      <span className="inline-flex gap-1">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            unselect(e.id);
                            remove.mutate(e.id);
                            setConfirmId(null);
                          }}
                        >
                          Confirm delete
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmId(null)}>
                          Cancel
                        </Button>
                      </span>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setConfirmId(e.id)} aria-label={`Delete ${name}`}>
                        Delete
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav aria-label="History pages" className="flex items-center justify-between text-sm">
          <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            ← Newer
          </Button>
          <span className="text-muted">
            Page {page + 1} of {pages} · {data.total} estimates
          </span>
          <Button variant="secondary" size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
            Older →
          </Button>
        </nav>
      )}
    </div>
  );
}
