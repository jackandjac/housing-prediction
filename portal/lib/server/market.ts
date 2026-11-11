import "server-only";
import { backends } from "../config";
import type {
  CacheStats,
  Correlation,
  Distribution,
  MarketMeta,
  MarketSummary,
  ModelFit,
  PropertyPage,
  Segments,
} from "../types";
import { backendJson } from "./fetch";

const url = (path: string, params?: URLSearchParams) =>
  `${backends.market}/api/market${path}${params && params.size ? `?${params}` : ""}`;

export const getMeta = () => backendJson<MarketMeta>(url("/meta"), "market");
export const getSummary = (f: URLSearchParams) => backendJson<MarketSummary>(url("/summary", f), "market");
export const getSegments = (f: URLSearchParams, groupBy: string) => {
  const p = new URLSearchParams(f);
  p.set("groupBy", groupBy);
  return backendJson<Segments>(url("/segments", p), "market");
};
export const getDistribution = (f: URLSearchParams, field = "price", bins = 8) => {
  const p = new URLSearchParams(f);
  p.set("field", field);
  p.set("bins", String(bins));
  return backendJson<Distribution>(url("/distribution", p), "market");
};
export const getCorrelations = (f: URLSearchParams) => backendJson<Correlation[]>(url("/correlations", f), "market");
export const getProperties = (p: URLSearchParams) => backendJson<PropertyPage>(url("/properties", p), "market");
export const getModelFit = () => backendJson<ModelFit>(url("/model-fit"), "market");
export const getCacheStats = () => backendJson<CacheStats[]>(url("/cache-stats"), "market");
