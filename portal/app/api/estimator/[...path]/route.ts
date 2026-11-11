import type { NextRequest } from "next/server";
import { backends } from "@/lib/config";
import { forward } from "@/lib/server/proxy";

type Ctx = RouteContext<"/api/estimator/[...path]">;

const opts = {
  base: backends.estimator,
  prefix: "",
  allowed: ["estimates", "form-schema", "health"],
  service: "estimator",
};

export async function GET(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).path, opts);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).path, opts);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).path, opts);
}
