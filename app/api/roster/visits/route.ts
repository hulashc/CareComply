import { NextRequest } from "next/server";
import { json, readJson, readQuery, withAdmin } from "@/lib/roster/http";
import { createVisitSchema, listVisitsQuerySchema } from "@/lib/roster/schemas";
import { createVisits, listVisits } from "@/lib/roster/visit-service";

// GET  /api/roster/visits?from=YYYY-MM-DD&to=YYYY-MM-DD[&client_id&carer_id&location_id&status=a,b
//                          &roster_state&series_id&skill&unassigned=true&limit&offset]
// POST /api/roster/visits  create one visit, or a recurring series when `recurrence` is given
export async function GET(req: NextRequest) {
  return withAdmin({ rate: { name: "roster-read", limit: 120 } }, async (ctx) =>
    json(await listVisits(ctx, readQuery(req, listVisitsQuerySchema))),
  );
}

export async function POST(req: NextRequest) {
  return withAdmin({ rate: { name: "roster-write", limit: 30 } }, async (ctx) =>
    json({ success: true, ...(await createVisits(ctx, await readJson(req, createVisitSchema))) }, 201),
  );
}
