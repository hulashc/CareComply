import { NextRequest } from "next/server";
import { deleteUnavailability } from "@/lib/roster/availability-service";
import { idParam, json, withAdmin } from "@/lib/roster/http";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; blockId: string }> }) {
  return withAdmin({ rate: { name: "roster-write", limit: 30 } }, async (ctx) => {
    const { id, blockId } = await params;
    await deleteUnavailability(ctx, idParam(id, "Carer"), idParam(blockId, "Unavailability block"));
    return json({ success: true });
  });
}
