import { connection } from "next/server";
import { adminConfigured, requireAdmin } from "@/lib/server/admin";

/** Whether Model Studio's write actions are enabled on this server. */
export async function GET() {
  await connection(); // read the env var per request, not at build time
  return Response.json({ configured: adminConfigured() });
}

/** Checks the token in the x-admin-token header: 204 when right, 401/403 otherwise. */
export async function POST(req: Request) {
  return requireAdmin(req) ?? new Response(null, { status: 204 });
}
