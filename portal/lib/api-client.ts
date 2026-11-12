import { ApiError, toApiError } from "./errors";

/**
 * Browser-side fetch to the portal's own route handlers (/api/estimator/*, /api/market/*),
 * which forward to the backends. Throws ApiError with field errors normalised.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      // JSON bodies only: for FormData the browser must set the multipart content-type (with its boundary).
      headers: { accept: "application/json", ...(typeof init?.body === "string" ? { "content-type": "application/json" } : {}), ...init?.headers },
    });
  } catch {
    throw new ApiError("You appear to be offline. Check your connection and try again.", 0);
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res.status, body, `Request failed (HTTP ${res.status}).`);
  return body as T;
}
