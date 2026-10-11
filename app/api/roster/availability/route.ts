import { NextRequest } from "next/server";
import { getAvailability } from "@/lib/roster/availability-service";
import { json, readQuery, withAdmin } from "@/lib/roster/http";
import { rangeQuerySchema } from "@/lib/roster/schemas";

// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD: every carer's working hours, approved/pending leave and
// part-day unavailability over the range (max 62 days).
export async function GET(req: NextRequest) {
  return withAdmin({ rate: { name: "roster-read", limit: 120 } }, async (ctx) => {
    const { from, to } = readQuery(req, rangeQuerySchema);
    return json(await getAvailability(ctx, from, to));
  });
}
