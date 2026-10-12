import { NextRequest } from "next/server";
import { json, readJson, withAdmin } from "@/lib/roster/http";
import { bulkSchema } from "@/lib/roster/schemas";
import { bulkOperate } from "@/lib/roster/visit-service";

// POST body: { action, ids | filter, carer_id?, status?, changes?, force?, dry_run? }
// Returns a result per visit; the visits that pass are applied together in one transaction.
export async function POST(req: NextRequest) {
  return withAdmin({ rate: { name: "roster-bulk", limit: 10 } }, async (ctx) =>
    json({ success: true, ...(await bulkOperate(ctx, await readJson(req, bulkSchema))) }),
  );
}
