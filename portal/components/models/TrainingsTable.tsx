"use client";

import Link from "next/link";
import { Alert, Badge, EmptyState } from "@/components/ui/Feedback";
import { ButtonLink } from "@/components/ui/Button";
import { LocalTime } from "@/components/ui/LocalTime";
import { useTrainings } from "@/hooks/useMl";
import { errorMessage } from "@/lib/errors";
import { STATUS_LABEL, STATUS_TONE, jobDuration } from "@/lib/ml";
import type { TrainingJob } from "@/lib/types";

/** Training jobs, newest first. Refreshes every 2 s while any job is unfinished. */
export function TrainingsTable({ initial }: { initial: TrainingJob[] }) {
  const { data = initial, error } = useTrainings(initial);
  if (data.length === 0) {
    return (
      <EmptyState title="No training jobs yet" action={<ButtonLink href="/models/train">Train a model</ButtonLink>}>
        Jobs appear here as soon as a file is accepted.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-3">
      {error && <Alert title="Couldn’t refresh the job list">{errorMessage(error)}</Alert>}
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
        <table className="w-full min-w-[760px] text-sm">
          <caption className="sr-only">Training jobs</caption>
          <thead className="bg-surface-2 text-left text-xs text-muted uppercase">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Job</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-4 py-2.5 font-medium">File</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Rows</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Type</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Submitted</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Took</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Result</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {data.map((j) => (
              <tr key={j.id} className="border-t border-line align-top">
                <th scope="row" className="px-4 py-3 text-left font-mono text-xs font-normal">{j.id}</th>
                <td className="px-4 py-3"><Badge tone={STATUS_TONE[j.status]}>{STATUS_LABEL[j.status]}</Badge></td>
                <td className="max-w-48 truncate px-4 py-3" title={j.source_filename ?? undefined}>{j.source_filename ?? "–"}</td>
                <td className="px-4 py-3 text-right">{j.rows}</td>
                <td className="px-4 py-3">{j.model_type === "ridge" ? `Ridge α ${j.alpha ?? 1}` : "Linear"}</td>
                <td className="px-4 py-3 whitespace-nowrap"><LocalTime iso={j.created_at} /></td>
                <td className="px-4 py-3 text-right">{jobDuration(j) ?? "–"}</td>
                <td className="px-4 py-3">
                  {j.model_id ? (
                    <Link href={`/models/${j.model_id}`} className="font-mono text-xs text-accent hover:underline">
                      {j.model_id}
                    </Link>
                  ) : j.error ? (
                    <span className="text-negative">{j.error}</span>
                  ) : (
                    <span className="text-muted">–</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
