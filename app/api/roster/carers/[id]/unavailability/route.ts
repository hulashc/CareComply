import { NextRequest } from "next/server";
import { addUnavailability } from "@/lib/roster/availability-service";
import { idParam, json, readJson, withAdmin } from "@/lib/roster/http";
import { unavailabilitySchema } from "@/lib/roster/schemas";

// POST body: { date, start_time, end_time, end_date?, reason? } (London time) for a part-day block.
// Leave and sick days stay on /api/absences. Returns visits the carer is already on during the block.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin({ rate: { name: "roster-write", limit: 30 } }, async (ctx) => {
    const id = idParam((await params).id, "Carer");
    return json({ success: true, ...(await addUnavailability(ctx, id, await readJson(req, unavailabilitySchema))) }, 201);
  });
}
