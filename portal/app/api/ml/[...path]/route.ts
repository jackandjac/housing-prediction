import type { NextRequest } from "next/server";
import { backends } from "@/lib/config";
import { mlRouteKind } from "@/lib/ml";
import { requireAdmin } from "@/lib/server/admin";
import { forward } from "@/lib/server/proxy";

type Ctx = RouteContext<"/api/ml/[...path]">;

/**
 * Model Studio's proxy to ml-api. Reads are open; uploads and model switches need the
 * admin token (checked here; forward() never passes it on to ml-api).
 */
async function handle(req: NextRequest, ctx: Ctx) {
  const path = (await ctx.params).path;
  const kind = mlRouteKind(req.method, path);
  if (!kind) return Response.json({ detail: { message: "Not found.", errors: [] } }, { status: 404 });
  if (kind === "write") {
    const denied = requireAdmin(req);
    if (denied) return denied;
  }
  return forward(req, path, { base: backends.ml, prefix: "", allowed: [path[0]], service: "ML" });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
