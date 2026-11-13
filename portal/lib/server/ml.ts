import "server-only";
import { backends } from "../config";
import type { MlHealth, ModelInfo, ModelSummary, TrainingJob } from "../types";

export type MlFeatures = {
  model_id: string | null;
  target: string;
  features: { name: string; type: string; min: number | null; max: number | null; description: string }[];
};
import { backendJson } from "./fetch";

const url = (path: string) => `${backends.ml}${path}`;

export const getModels = () => backendJson<ModelSummary[]>(url("/models"), "ML");
export const getTrainings = (limit = 50) => backendJson<TrainingJob[]>(url(`/trainings?limit=${limit}`), "ML");
export const getModelInfo = (id: string) =>
  backendJson<ModelInfo>(url(`/model-info?model_id=${encodeURIComponent(id)}`), "ML");
export const getMlHealth = () => backendJson<MlHealth>(url("/health"), "ML");
export const getMlFeatures = () => backendJson<MlFeatures>(url("/features"), "ML");
