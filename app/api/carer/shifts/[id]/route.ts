import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/services/audit-service";
import type { Database } from "@/lib/database.types";

type CheckAction = "check_in" | "check_out";

async function getAuthUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const authClient = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } },
  );
  const { data: { user } } = await authClient.auth.getUser();
  return user?.id ?? null;
}

function isCheckAction(value: unknown): value is CheckAction {
  return value === "check_in" || value === "check_out";
}

/** Carer records the actual start / end of one of their own visits. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const action = typeof body === "object" && body !== null ? (body as { action?: unknown }).action : undefined;
  if (!isCheckAction(action)) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const { id } = await params;
  const svc = createAdminClient();

  const { data: carer } = await svc.from("carers").select("id, org_id").eq("auth_id", userId).single();
  if (!carer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: shift } = await svc
    .from("shifts")
    .select("id, carer_id, org_id, status, actual_start, actual_end")
    .eq("id", id)
    .single();
  if (!shift || shift.carer_id !== carer.id) return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  if (shift.status === "cancelled") return NextResponse.json({ error: "Shift is cancelled" }, { status: 409 });

  const now = new Date().toISOString();

  if (action === "check_in") {
    if (shift.actual_start) return NextResponse.json({ error: "Already checked in" }, { status: 409 });
    const { error } = await svc
      .from("shifts")
      .update({ actual_start: now, status: "in_progress" })
      .eq("id", id)
      .eq("carer_id", carer.id)
      .is("actual_start", null);
    if (error) return NextResponse.json({ error: "Failed to check in" }, { status: 500 });
  } else {
    if (!shift.actual_start) return NextResponse.json({ error: "Check in first" }, { status: 409 });
    if (shift.actual_end) return NextResponse.json({ error: "Already checked out" }, { status: 409 });
    const { error } = await svc
      .from("shifts")
      .update({ actual_end: now, status: "completed" })
      .eq("id", id)
      .eq("carer_id", carer.id)
      .is("actual_end", null);
    if (error) return NextResponse.json({ error: "Failed to check out" }, { status: 500 });
  }

  await logAudit({
    action,
    entityType: "shift",
    entityId: id,
    orgId: shift.org_id ?? carer.org_id ?? undefined,
    details: `Carer ${action === "check_in" ? "checked in" : "checked out"} at ${now}`,
  });

  return NextResponse.json({ success: true, at: now });
}
