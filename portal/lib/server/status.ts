import "server-only";
import { backends } from "../config";

import type { ServiceStatus } from "../types";

export type { ServiceStatus };

async function probe(url: string): Promise<{ ok: boolean; body: Record<string, unknown> | null }> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3_000) });
    return { ok: res.ok, body: await res.json().catch(() => null) };
  } catch {
    return { ok: false, body: null };
  }
}

/** Health of every backend, checked in parallel. */
export async function getServiceStatus(): Promise<ServiceStatus[]> {
  const [ml, est, market] = await Promise.all([
    probe(`${backends.ml}/health`),
    probe(`${backends.estimator}/health`),
    probe(`${backends.market}/actuator/health`),
  ]);
  return [
    {
      name: "ML API",
      description: "FastAPI · scikit-learn",
      state: !ml.ok ? "down" : ml.body?.model_loaded ? "up" : "degraded",
      detail: ml.body?.active_model_id ? `Model ${ml.body.active_model_id}` : undefined,
    },
    {
      name: "Estimator API",
      description: "FastAPI · MongoDB",
      state: !est.ok ? "down" : est.body?.status === "ok" ? "up" : "degraded",
      detail: est.body?.status === "degraded" ? `Database ${est.body.database}, ML ${est.body.ml_api}` : undefined,
    },
    {
      name: "Market API",
      description: "Spring Boot · Caffeine",
      state: !market.ok ? "down" : market.body?.status === "UP" ? "up" : "degraded",
    },
  ];
}
