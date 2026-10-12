import { listClients } from "@/lib/roster/availability-service";
import { json, withAdmin } from "@/lib/roster/http";

// Read-only list of the org's active clients (id, name, team, postcode) for the roster calendar.
export async function GET() {
  return withAdmin({ rate: { name: "roster-read", limit: 120 } }, async (ctx) => json(await listClients(ctx)));
}
