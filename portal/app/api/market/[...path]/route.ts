import type { NextRequest } from "next/server";
import { backends } from "@/lib/config";
import { forward } from "@/lib/server/proxy";

type Ctx = RouteContext<"/api/market/[...path]">;

const opts = {
  base: backends.market,
  prefix: "/api/market",
  allowed: [
    "meta",
    "summary",
    "segments",
    "distribution",
    "correlations",
    "properties",
    "what-if",
    "model-fit",
    "export.csv",
    "export.pdf",
    "cache-stats",
  ],
  service: "market analysis",
};

export async function GET(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).path, opts);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).path, opts);
}
