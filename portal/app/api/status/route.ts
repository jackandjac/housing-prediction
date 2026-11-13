import { connection } from "next/server";
import { getServiceStatus } from "@/lib/server/status";

/** Live health of every backend, polled by the service status panels. */
export async function GET() {
  await connection();
  return Response.json(await getServiceStatus());
}
