export type Settled<T> = { ok: true; data: T } | { ok: false; error: unknown };

/**
 * Await a promise without try/catch around JSX: server components fetch with this,
 * then branch on the result. (Render errors are handled by error.tsx boundaries, not try/catch.)
 */
export async function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, data: await promise };
  } catch (error) {
    return { ok: false, error };
  }
}
