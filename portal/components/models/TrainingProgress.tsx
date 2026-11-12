"use client";

import Link from "next/link";
import { Alert, Badge } from "@/components/ui/Feedback";
import { useLastActivation, useTraining } from "@/hooks/useMl";
import { errorMessage } from "@/lib/errors";
import { STATUS_LABEL, STATUS_TONE, jobDuration } from "@/lib/ml";
import type { JobStatus } from "@/lib/types";
import { ActivateButton, SWITCH_NOTE } from "./ActivateButton";

const STEPS: JobStatus[] = ["submitted", "running", "succeeded"];

/** Live status of one training job, polled every second until it finishes. */
export function TrainingProgress({ jobId, configured }: { jobId: string; configured: boolean }) {
  const { data: job, error } = useTraining(jobId);
  const activated = useLastActivation();

  if (error && !job) return <Alert title="Couldn’t check the training job">{errorMessage(error)}</Alert>;
  if (!job) return <p className="text-sm text-muted">Starting…</p>;

  const reached = job.status === "failed" ? -1 : STEPS.indexOf(job.status);
  return (
    <div className="space-y-4" aria-live="polite">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={STATUS_TONE[job.status]}>{STATUS_LABEL[job.status]}</Badge>
        <span className="font-mono text-xs text-muted">{job.id}</span>
        <span className="text-sm text-muted">
          {job.source_filename} · {job.rows} rows · {job.model_type}
          {job.alpha != null && job.model_type === "ridge" ? ` α ${job.alpha}` : ""}
        </span>
      </div>

      <ol className="flex flex-wrap gap-2 text-sm">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`rounded-full border px-3 py-1 ${i <= reached ? "border-accent bg-accent-soft text-accent" : "border-line text-muted"}`}
          >
            {i + 1}. {STATUS_LABEL[s]}
          </li>
        ))}
      </ol>

      {job.ignored_columns.length > 0 && (
        <p className="text-sm text-muted">Columns not used by the model: {job.ignored_columns.join(", ")}.</p>
      )}

      {job.status === "failed" && <Alert title="Training failed">{job.error ?? "No error message was recorded."}</Alert>}

      {job.status === "succeeded" && job.model_id && (
        <div className="space-y-3">
          {job.activated || activated === job.model_id ? (
            <Alert tone="positive" title={`${job.model_id} is now the active model`}>
              {job.activated ? "It was the first model, so it went live automatically. " : ""}
              {SWITCH_NOTE}
            </Alert>
          ) : (
            <Alert
              tone="positive"
              title="Model trained"
              action={<ActivateButton modelId={job.model_id} configured={configured} />}
            >
              New models aren’t used for predictions until you make them active. Compare it with the current one on the{" "}
              <Link href="/models" className="underline">overview</Link> first.
            </Alert>
          )}
          <p className="text-sm">
            Finished in {jobDuration(job) ?? "–"}.{" "}
            <Link href={`/models/${job.model_id}`} className="text-accent hover:underline">
              See the model’s details →
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
