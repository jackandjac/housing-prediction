/**
 * One error shape for both backends:
 *  - estimator-api (FastAPI): { detail: { message, errors: [{ field, message }] } } or { detail: "..." }
 *  - market-api (Spring ProblemDetail): { title, detail, errors: ["..."] }
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fieldErrors: Record<string, string> = {},
    public readonly errors: string[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function toApiError(status: number, body: unknown, fallback: string): ApiError {
  const b = (body ?? {}) as Record<string, unknown>;
  const detail = b.detail;
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const d = detail as { message?: string; errors?: { field: string; message: string }[] };
    const fieldErrors: Record<string, string> = {};
    for (const e of d.errors ?? []) fieldErrors[e.field] = e.message;
    return new ApiError(d.message ?? fallback, status, fieldErrors, (d.errors ?? []).map((e) => `${e.field} ${e.message}`));
  }
  if (Array.isArray(b.errors) && b.errors.every((e) => typeof e === "string")) {
    return new ApiError(typeof detail === "string" ? detail : fallback, status, {}, b.errors as string[]);
  }
  return new ApiError(typeof detail === "string" ? detail : fallback, status);
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
