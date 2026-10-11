import { NextRequest } from "next/server";
import { idParam, json, readQuery, withAdmin } from "@/lib/roster/http";
import { deleteVisitQuerySchema } from "@/lib/roster/schemas";
import { unassignCarer } from "@/lib/roster/visit-service";

// DELETE ?scope=this|following|all (default this)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; carerId: string }> }) {
  return withAdmin({ rate: { name: "roster-write", limit: 30 } }, async (ctx) => {
    const { id, carerId } = await params;
    const { scope } = readQuery(req, deleteVisitQuerySchema);
    return json({ success: true, ...(await unassignCarer(ctx, idParam(id, "Visit"), idParam(carerId, "Carer"), scope)) });
  });
}
