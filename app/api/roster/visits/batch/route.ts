import { NextRequest } from "next/server";
import { json, readJson, withAdmin } from "@/lib/roster/http";
import { batchSchema } from "@/lib/roster/schemas";
import { applyBatch } from "@/lib/roster/visit-service";

// POST body: { upserts: VisitSnap[], deletes: {id, updated_at}[], force?, reason?, label? }
// One atomic change set from the calendar (move, resize, assign, create, delete, undo, redo).
// 409 { code: "STALE", ids } when a visit changed since the client loaded it;
// 409 { code: "BLOCKED" | "OVERRIDE_REQUIRED", issues } for eligibility problems.
export async function POST(req: NextRequest) {
  return withAdmin({ rate: { name: "roster-batch-edit", limit: 120 } }, async (ctx) =>
    json({ success: true, ...(await applyBatch(ctx, await readJson(req, batchSchema))) }),
  );
}
