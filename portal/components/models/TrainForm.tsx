"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { useSubmitTraining } from "@/hooks/useMl";
import { ApiError, errorMessage } from "@/lib/errors";
import { validateTrainingInput } from "@/lib/ml";
import { useCanWrite } from "./AdminAccess";
import { TrainingProgress } from "./TrainingProgress";

/** Upload a CSV and start training. ml-api validates the file before accepting it. */
export function TrainForm({ configured }: { configured: boolean }) {
  const canWrite = useCanWrite(configured);
  const submit = useSubmitTraining();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [modelType, setModelType] = useState("ridge");
  const [alpha, setAlpha] = useState("1");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [jobId, setJobId] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = validateTrainingInput({ file, modelType, alpha });
    setErrors(found);
    if (Object.keys(found).length || !file) return;
    const form = new FormData();
    form.append("file", file);
    form.append("model_type", modelType);
    if (modelType === "ridge") form.append("alpha", alpha.trim());
    submit.mutate(form, { onSuccess: (job) => setJobId(job.id) });
  }

  function reset() {
    setJobId(null);
    setFile(null);
    submit.reset();
    if (fileRef.current) fileRef.current.value = "";
  }

  if (jobId) {
    return (
      <div className="space-y-4">
        <TrainingProgress jobId={jobId} configured={configured} />
        <Button variant="secondary" onClick={reset}>
          Train another model
        </Button>
      </div>
    );
  }

  const serverError = submit.error;
  const fileErrors = serverError instanceof ApiError ? serverError.errors : [];

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Field
        ref={fileRef}
        id="file"
        label="Training data"
        type="file"
        accept=".csv,text/csv"
        hint="A CSV with the feature columns and a price column. Up to 5 MB."
        error={errors.file}
        className="[&_input]:py-1.5"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select id="model_type" label="Model type" value={modelType} onChange={(e) => setModelType(e.target.value)}>
          <option value="ridge">Ridge (regularised)</option>
          <option value="linear">Linear</option>
        </Select>
        {modelType === "ridge" && (
          <Field
            id="alpha"
            label="Alpha"
            inputMode="decimal"
            value={alpha}
            onChange={(e) => setAlpha(e.target.value)}
            hint="Higher values shrink coefficients more. 1 is a good start."
            error={errors.alpha}
          />
        )}
      </div>

      {serverError && (
        <Alert title={serverError instanceof ApiError && serverError.status === 422 ? "The file can’t be used for training" : "Training didn’t start"}>
          <p>{errorMessage(serverError)}</p>
          {fileErrors.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {fileErrors.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!canWrite || submit.isPending}>
          {submit.isPending ? "Uploading…" : "Start training"}
        </Button>
        {!canWrite && <span className="text-sm text-muted">Unlock with the admin token above to train.</span>}
      </div>
    </form>
  );
}
