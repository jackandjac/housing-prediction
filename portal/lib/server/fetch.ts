import "server-only";
import { ApiError, toApiError } from "../errors";

/** Server-side JSON fetch to a backend. Uncached: callers render inside <Suspense>. */
export async function backendJson<T>(url: string, service: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000), headers: { accept: "application/json" } });
  } catch {
    throw new ApiError(`The ${service} service is unreachable.`, 503);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res.status, body, `The ${service} service returned HTTP ${res.status}.`);
  return body as T;
}
