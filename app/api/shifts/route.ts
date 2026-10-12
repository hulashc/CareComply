import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { logAudit } from "@/lib/services/audit-service";
import { rateLimit } from "@/lib/rate-limit";
import { verifyOrgOwnership } from "@/lib/services/ownership";

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const rl = await rateLimit(`shifts:${admin.id}`, 10);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { client_id, carer_id, start_time, end_time, notes, recurrence_type, recurrence_end_date } = body;

  if (!client_id || !start_time || !end_time) return NextResponse.json({ error: "Client, start time, and end time are required" }, { status: 400 });
  if (new Date(end_time) <= new Date(start_time)) return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });

  const adminClient = createAdminClient();

  if (!await verifyOrgOwnership(adminClient, "clients", client_id, admin.org_id ?? "")) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if (carer_id && !await verifyOrgOwnership(adminClient, "carers", carer_id, admin.org_id ?? "")) {
    return NextResponse.json({ error: "Carer not found" }, { status: 404 });
  }

  if (recurrence_type && recurrence_type !== "none" && recurrence_end_date) {
    if (!start_time.includes("T") || !end_time.includes("T")) {
      return NextResponse.json({ error: "Invalid datetime format. Expected ISO 8601." }, { status: 400 });
    }

    const MAX_RECURRING_SHIFTS = 365;
    const baseDate = new Date(start_time);
    const endDate = new Date(recurrence_end_date);
    const shifts = [];
    const current = new Date(baseDate);

    while (current <= endDate && shifts.length < MAX_RECURRING_SHIFTS) {
      const s = new Date(current);
      const e = new Date(current);
      const [sh, sm] = start_time.split("T")[1].split(":");
      const [eh, em] = end_time.split("T")[1].split(":");
      s.setHours(parseInt(sh), parseInt(sm), 0, 0);
      e.setHours(parseInt(eh), parseInt(em), 0, 0);

      shifts.push({
        client_id, carer_id: carer_id || null, org_id: admin.org_id,
        start_time: s.toISOString(), end_time: e.toISOString(),
        notes: notes || null, status: "scheduled",
        recurrence_type, recurrence_end_date,
      });

      if (recurrence_type === "daily") current.setDate(current.getDate() + 1);
      else if (recurrence_type === "weekly") current.setDate(current.getDate() + 7);
      else if (recurrence_type === "monthly") current.setMonth(current.getMonth() + 1);
      else break;
    }

    const { error } = await adminClient.from("shifts").insert(shifts);
    if (error) return NextResponse.json({ error: "Failed to create recurring shifts" }, { status: 500 });
    logAudit({ action: "shifts_created", entityType: "shift", actorId: admin.id, orgId: admin.org_id, details: `Created ${shifts.length} recurring shifts for ${client_id}` }).catch(() => {});
    return NextResponse.json({ success: true, count: shifts.length });
  }

  const { error } = await adminClient.from("shifts").insert({
    client_id, carer_id: carer_id || null, org_id: admin.org_id,
    start_time, end_time, notes: notes || null, status: "scheduled",
    recurrence_type: recurrence_type || "none", recurrence_end_date: recurrence_end_date || null,
  });

  if (error) return NextResponse.json({ error: "Failed to create shift" }, { status: 500 });
  logAudit({ action: "shift_created", entityType: "shift", actorId: admin.id, orgId: admin.org_id, details: `Scheduled shift for ${client_id}` }).catch(() => {});
  return NextResponse.json({ success: true });
}
