import { NextRequest } from "next/server";
import { idParam, json, readJson, withAdmin } from "@/lib/roster/http";
import { assignSchema } from "@/lib/roster/schemas";
import { assignCarer } from "@/lib/roster/visit-service";

// POST body: { carer_id, scope?: "this" | "following" | "all", force?: boolean }
// 409 with { issues } when the carer cannot be assigned (blocked, or overridable without force).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin({ rate: { name: "roster-write", limit: 30 } }, async (ctx) => {
    const id = idParam((await params).id, "Visit");
    return json({ success: true, ...(await assignCarer(ctx, id, await readJson(req, assignSchema))) });
  });
}
