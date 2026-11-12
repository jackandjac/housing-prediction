import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/** Header the browser sends with write requests to Model Studio routes. */
export const ADMIN_HEADER = "x-admin-token";

/**
 * Read at request time, never at build time: callers must be dynamic
 * (a route handler that reads the request, or a component after `await connection()`).
 */
export function adminConfigured(): boolean {
  return Boolean(process.env.MODEL_ADMIN_TOKEN?.trim());
}

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();

/** Constant-time comparison of SHA-256 digests (equal length, so the token length isn't revealed). */
export function isAdminToken(candidate: string | null): boolean {
  const expected = process.env.MODEL_ADMIN_TOKEN?.trim();
  if (!expected || !candidate) return false;
  return timingSafeEqual(digest(candidate.trim()), digest(expected));
}

const problem = (status: number, message: string) =>
  Response.json({ detail: { message, errors: [] } }, { status });

/** null when the request may proceed; otherwise the 403/401 response to return. */
export function requireAdmin(req: Request): Response | null {
  if (!adminConfigured()) {
    return problem(403, "Training and model changes are turned off. Set MODEL_ADMIN_TOKEN for the portal to enable them.");
  }
  if (!isAdminToken(req.headers.get(ADMIN_HEADER))) {
    return problem(401, "The admin token is missing or wrong.");
  }
  return null;
}
