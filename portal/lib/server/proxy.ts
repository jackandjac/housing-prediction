import "server-only";
import type { NextRequest } from "next/server";

const FORWARD_RESPONSE_HEADERS = ["content-type", "content-disposition", "cache-control"];

/**
 * Forward a request from the browser to a backend (backend-for-frontend).
 * Only allow-listed path prefixes are forwarded, so the portal never becomes an open proxy.
 */
export async function forward(
  req: NextRequest,
  path: string[],
  opts: { base: string; prefix: string; allowed: string[]; service: string },
): Promise<Response> {
  if (!path.length || !opts.allowed.includes(path[0])) {
    return Response.json({ detail: { message: "Not found.", errors: [] } }, { status: 404 });
  }
  const target = new URL(`${opts.base}${opts.prefix}/${path.map(encodeURIComponent).join("/")}`);
  target.search = req.nextUrl.search;

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers: {
        accept: req.headers.get("accept") ?? "*/*",
        ...(hasBody ? { "content-type": req.headers.get("content-type") ?? "application/json" } : {}),
      },
      body: hasBody ? await req.arrayBuffer() : undefined,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return Response.json(
      { detail: { message: `The ${opts.service} service is unreachable. Try again shortly.`, errors: [] } },
      { status: 502 },
    );
  }
  const headers = new Headers();
  for (const h of FORWARD_RESPONSE_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(upstream.status === 204 ? null : upstream.body, { status: upstream.status, headers });
}
