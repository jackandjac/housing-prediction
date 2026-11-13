import { number } from "./format";
import type { JobStatus, TrainingJob } from "./types";

/** ml-api's limit (MAX_UPLOAD_BYTES default). Checked in the browser too, to fail fast. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const isFinished = (s: JobStatus) => s === "succeeded" || s === "failed";

export const STATUS_LABEL: Record<JobStatus, string> = {
  submitted: "Queued",
  running: "Training",
  succeeded: "Succeeded",
  failed: "Failed",
};

export const STATUS_TONE = {
  submitted: "neutral",
  running: "accent",
  succeeded: "positive",
  failed: "negative",
} as const satisfies Record<JobStatus, string>;

/** "under 1 s", "1.2 s", "45 s", "3 min 4 s"; null while the job hasn't finished. */
export function jobDuration(job: Pick<TrainingJob, "created_at" | "finished_at">): string | null {
  if (!job.finished_at) return null;
  const ms = Date.parse(job.finished_at) - Date.parse(job.created_at);
  if (!Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1000) return "under 1 s";
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)} s`;
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}

export type TrainingInput = { file: { name: string; size: number } | null; modelType: string; alpha: string };

/** Browser-side checks before upload. ml-api validates the CSV content itself. */
export function validateTrainingInput(input: TrainingInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.file) errors.file = "Choose a CSV file";
  else if (!input.file.name.toLowerCase().endsWith(".csv")) errors.file = "The file must be a .csv";
  else if (input.file.size === 0) errors.file = "The file is empty";
  else if (input.file.size > MAX_UPLOAD_BYTES) errors.file = "The file is larger than 5 MB";
  if (input.modelType !== "linear" && input.modelType !== "ridge") errors.modelType = "Choose linear or ridge";
  if (input.modelType === "ridge") {
    const a = Number(input.alpha);
    if (input.alpha.trim() === "" || !Number.isFinite(a) || a <= 0) errors.alpha = "Alpha must be a number greater than 0";
  }
  return errors;
}

/**
 * Which ml-api requests the portal forwards. Everything else is refused, including ids
 * with path tricks: ids must be plain [A-Za-z0-9_-].
 */
const ID = /^[A-Za-z0-9_-]+$/;

export function mlRouteKind(method: string, path: string[]): "read" | "write" | null {
  const [a, b, ...rest] = path;
  if (rest.length) return null;
  if (method === "GET") {
    if (b === undefined && ["trainings", "models", "model-info", "features", "health"].includes(a)) return "read";
    if (a === "trainings" && b !== undefined && ID.test(b)) return "read";
    return null;
  }
  if (method === "POST" && a === "trainings" && b === undefined) return "write";
  if (method === "PUT" && a === "models" && b === "active") return "write";
  return null;
}

/** "Linear" or "Ridge (α 1)". Usable from server and client components. */
export function modelTypeLabel(m: { model_type: string; hyperparameters?: Record<string, number> }) {
  const a = m.hyperparameters?.alpha;
  return m.model_type === "ridge" ? `Ridge${a != null ? ` (α ${number(a)})` : ""}` : "Linear";
}
