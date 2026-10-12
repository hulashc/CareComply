import { NextRequest } from "next/server";
import { setWorkingHours } from "@/lib/roster/availability-service";
import { idParam, json, readJson, withAdmin } from "@/lib/roster/http";
import { workingHoursSchema } from "@/lib/roster/schemas";

// PUT body: { mon?: [{start:"07:00", end:"14:00"}], tue?: [...], ... } in London time.
// Replaces the whole weekly pattern; {} clears it (= no restriction).
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin({ rate: { name: "roster-write", limit: 30 } }, async (ctx) => {
    const id = idParam((await params).id, "Carer");
    return json({ success: true, working_hours: await setWorkingHours(ctx, id, await readJson(req, workingHoursSchema)) });
  });
}
