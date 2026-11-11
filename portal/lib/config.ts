import "server-only";

/**
 * Backend locations. Server-only: the browser never talks to the backends directly,
 * it goes through the portal's route handlers (app/api/*), so these never reach client bundles.
 */
export const backends = {
  estimator: process.env.ESTIMATOR_API_URL ?? "http://127.0.0.1:8001",
  market: process.env.MARKET_API_URL ?? "http://127.0.0.1:8080",
  ml: process.env.ML_API_URL ?? "http://127.0.0.1:8000",
} as const;
