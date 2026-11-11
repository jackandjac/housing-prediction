import "server-only";
import { backends } from "../config";
import type { Comparison, Estimate, EstimatePage, FormSchema } from "../types";
import { backendJson } from "./fetch";

const url = (path: string) => `${backends.estimator}${path}`;

export const getFormSchema = () => backendJson<FormSchema>(url("/form-schema"), "estimator");
export const getEstimates = (limit = 20, offset = 0) =>
  backendJson<EstimatePage>(url(`/estimates?limit=${limit}&offset=${offset}`), "estimator");
export const getEstimate = (id: string) => backendJson<Estimate>(url(`/estimates/${encodeURIComponent(id)}`), "estimator");
export const getComparison = (ids: string[]) =>
  backendJson<Comparison>(url(`/estimates/compare?ids=${ids.map(encodeURIComponent).join(",")}`), "estimator");
