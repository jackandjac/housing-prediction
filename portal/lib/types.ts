// ---- estimator-api (Python) ---------------------------------------------------

export type FormField = {
  name: string;
  label: string;
  type: "float" | "int";
  min: number | null;
  max: number | null;
  step: number;
  unit: string | null;
  description: string;
  example: number | null;
};

export type FormSchema = { model_id: string | null; fields: FormField[] };

export type Contribution = { feature: string; value: number; average: number; contribution: number };

export type Estimate = {
  id: string;
  label: string | null;
  inputs: Record<string, number>;
  predicted_price: number;
  model_id: string;
  model_type: string | null;
  breakdown: { baseline: number; contributions: Contribution[] } | null;
  created_at: string;
};

export type EstimatePage = { items: Estimate[]; total: number; limit: number; offset: number };

export type Comparison = {
  items: Estimate[];
  features: string[];
  cheapest_id: string;
  most_expensive_id: string;
};

export type ServiceHealth = { status: string; [key: string]: unknown };

/** Health of one backend as shown in the status panels (built by lib/server/status.ts). */
export type ServiceStatus = { name: string; description: string; state: "up" | "degraded" | "down"; detail?: string };

// ---- market-api (Java) ----------------------------------------------------------

export type Summary5 = { min: number; p25: number; median: number; p75: number; max: number; mean: number };

export type MarketSummary = {
  count: number;
  totalProperties: number;
  price: Summary5 | null;
  pricePerSqft: Summary5 | null;
  featureAverages: Record<string, number>;
};

export type Segment = {
  key: string;
  label: string;
  count: number;
  medianPrice: number;
  meanPrice: number;
  minPrice: number;
  maxPrice: number;
  medianPricePerSqft: number | null;
};

export type Segments = { groupBy: string; feature: string; segments: Segment[] };

export type Distribution = { field: string; bins: { from: number; to: number; count: number }[] };

export type Correlation = { feature: string; r: number };

export type PropertyRow = {
  id: number;
  features: Record<string, number>;
  price: number;
  pricePerSqft: number | null;
};

export type PropertyPage = {
  items: PropertyRow[];
  total: number;
  page: number;
  size: number;
  sort: string;
  dir: "asc" | "desc";
};

export type MarketMeta = {
  totalProperties: number;
  features: string[];
  groupBy: string[];
  ranges: Record<string, [number, number]>;
};

export type WhatIfRequest = {
  base: Record<string, number>;
  vary: string;
  from: number;
  to: number;
  steps: number;
};

export type WhatIfResult = {
  modelId: string;
  vary: string;
  baseValue: number;
  basePrice: number;
  base: Record<string, number>;
  points: { value: number; price: number; delta: number }[];
  cached: boolean;
};

export type ModelFit = {
  modelId: string;
  count: number;
  mae: number;
  rmse: number;
  points: { id: number; actual: number; predicted: number; error: number }[];
  cached: boolean;
};

export type CacheStats = { name: string; size: number; hits: number; misses: number; hitRate: number; evictions: number };

// ---- ml-api (Python) ------------------------------------------------------------

export type JobStatus = "submitted" | "running" | "succeeded" | "failed";

export type Scores = { r2: number; mae: number; rmse: number };

export type ModelMetrics = {
  training: Scores;
  cross_validation: Scores & { folds: number };
  rows: number;
};

export type TrainingJob = {
  id: string;
  status: JobStatus;
  model_type: string;
  alpha: number | null;
  source_filename: string | null;
  dataset_sha256: string;
  rows: number;
  features: string[];
  ignored_columns: string[];
  callback_url: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  model_id: string | null;
  activated: boolean;
  webhook_status: string | null;
  webhook_attempts: number;
  webhook_last_error: string | null;
};

export type ModelSummary = {
  model_id: string;
  training_id: string;
  created_at: string;
  model_type: string;
  features: string[];
  dataset: { filename?: string | null; sha256?: string; rows?: number; ignored_columns?: string[] };
  metrics: ModelMetrics;
  is_active: boolean;
};

export type ModelInfo = ModelSummary & {
  target: string;
  hyperparameters: Record<string, number>;
  coefficients: {
    per_unit: Record<string, number>;
    intercept: number;
    standardized?: Record<string, number>;
    standardized_intercept?: number;
  };
  scaler: { mean: Record<string, number>; scale: Record<string, number> } | null;
};

export type MlHealth = { status: string; model_loaded: boolean; active_model_id: string | null };
