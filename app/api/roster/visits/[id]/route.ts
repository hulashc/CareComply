import { NextRequest } from "next/server";
import { idParam, json, readJson, readQuery, withAdmin } from "@/lib/roster/http";
import { deleteVisitQuerySchema, updateVisitSchema } from "@/lib/roster/schemas";
import { deleteVisit, getVisit, updateVisit } from "@/lib/roster/visit-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return withAdmin({ rate: { name: "roster-read", limit: 120 } }, async (ctx) =>
    json(await getVisit(ctx, idParam((await params).id, "Visit"))),
  );
}

// PATCH body: { scope?: "this" | "following" | "all", ...fields }. See updateVisitSchema.
export async function PATCH(req: NextRequest, { params }: Params) {
  return withAdmin({ rate: { name: "roster-write", limit: 30 } }, async (ctx) => {
    const id = idParam((await params).id, "Visit");
    return json({ success: true, ...(await updateVisit(ctx, id, await readJson(req, updateVisitSchema))) });
  });
}

// DELETE ?scope=this|following|all (default this)
export async function DELETE(req: NextRequest, { params }: Params) {
  return withAdmin({ rate: { name: "roster-write", limit: 30 } }, async (ctx) => {
    const id = idParam((await params).id, "Visit");
    const { scope } = readQuery(req, deleteVisitQuerySchema);
    return json({ success: true, ...(await deleteVisit(ctx, id, scope)) });
  });
}
