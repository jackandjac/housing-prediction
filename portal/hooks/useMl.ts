"use client";

import { useMutation, useMutationState, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { isFinished } from "@/lib/ml";
import type { ModelInfo, ModelSummary, ServiceStatus, TrainingJob } from "@/lib/types";
import { useAdminToken } from "./useAdminToken";

export const mlKeys = {
  all: ["ml"] as const,
  models: ["ml", "models"] as const,
  trainings: ["ml", "trainings"] as const,
  training: (id: string) => ["ml", "training", id] as const,
  status: ["status"] as const,
  activate: ["ml", "activate"] as const,
};

const adminHeaders = () => {
  const token = useAdminToken.getState().token;
  return token ? { "x-admin-token": token } : undefined;
};

export function useModels(initialData?: ModelSummary[]) {
  return useQuery({ queryKey: mlKeys.models, queryFn: () => apiFetch<ModelSummary[]>("/api/ml/models"), initialData });
}

/** Job list; refreshes every 2 s while any job is still queued or training. */
export function useTrainings(initialData?: TrainingJob[]) {
  return useQuery({
    queryKey: mlKeys.trainings,
    queryFn: () => apiFetch<TrainingJob[]>("/api/ml/trainings?limit=50"),
    initialData,
    refetchInterval: (q) => (q.state.data?.some((j) => !isFinished(j.status)) ? 2000 : false),
  });
}

/** One job, polled every second until it succeeds or fails. */
export function useTraining(id: string | null) {
  return useQuery({
    queryKey: mlKeys.training(id ?? ""),
    queryFn: () => apiFetch<TrainingJob>(`/api/ml/trainings/${encodeURIComponent(id!)}`),
    enabled: id !== null,
    refetchInterval: (q) => (q.state.data && isFinished(q.state.data.status) ? false : 1000),
  });
}

export function useSubmitTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) =>
      apiFetch<TrainingJob>("/api/ml/trainings", { method: "POST", body: form, headers: adminHeaders() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: mlKeys.trainings }),
  });
}

export function useActivateModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: mlKeys.activate,
    mutationFn: (modelId: string) =>
      apiFetch<ModelInfo>("/api/ml/models/active", {
        method: "PUT",
        body: JSON.stringify({ model_id: modelId }),
        headers: adminHeaders(),
      }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: mlKeys.all });
      void qc.invalidateQueries({ queryKey: mlKeys.status });
    },
  });
}

/** Backend health, refreshed every 15 s. */
export function useServiceStatus(initialData?: ServiceStatus[]) {
  return useQuery({
    queryKey: mlKeys.status,
    queryFn: () => apiFetch<ServiceStatus[]>("/api/status"),
    initialData,
    refetchInterval: 15_000,
  });
}

/** Id of the most recently activated model in this tab, if the last activation succeeded. */
export function useLastActivation(): string | null {
  const done = useMutationState({
    filters: { mutationKey: mlKeys.activate },
    select: (m) => (m.state.status === "success" ? (m.state.variables as string) : null),
  });
  return done.length ? done[done.length - 1] : null;
}
