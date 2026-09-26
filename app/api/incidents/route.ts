import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { logAudit } from "@/lib/services/audit-service";
import { rateLimit } from "@/lib/rate-limit";
import { verifyOrgOwnership } from "@/lib/services/ownership";
import { generateObject } from "ai";
import { getModel } from "@/lib/ai/client";
import { classifyIncident } from "@/lib/ai/prompts";

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const rl = await rateLimit(`incidents:${admin.id}`, 10);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { client_id, title, description, severity, category, action_taken } = body;

  if (!client_id || !title || !description) {
    return NextResponse.json({ error: "Client, title, and description are required" }, { status: 400 });
  }

  let aiSeverity = severity;
  let aiCategory = category;
  if (!severity || !category) {
    try {
      const { object } = await generateObject({
        model: getModel(),
        prompt: classifyIncident(title, description),
        output: "no-schema",
      });
      aiSeverity = (object as Record<string, string>)?.severity || severity;
      aiCategory = (object as Record<string, string>)?.category || category;
    } catch {
      aiSeverity = severity || "low";
      aiCategory = category || "other";
    }
  }

  const adminClient = createAdminClient();

  if (!await verifyOrgOwnership(adminClient, "clients", client_id, admin.org_id ?? "")) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { error } = await adminClient.from("incidents").insert({
    client_id,
    org_id: admin.org_id,
    title,
    description,
    severity: aiSeverity || "low",
    category: aiCategory || "other",
    action_taken: action_taken || null,
    status: "open",
  });

  if (error) {
    return NextResponse.json({ error: "Failed to create incident" }, { status: 500 });
  }

  logAudit({ action: "incident_reported", entityType: "incident", actorId: admin.id, orgId: admin.org_id, details: `Reported ${aiSeverity} ${aiCategory}: ${title}` }).catch(() => {});

  return NextResponse.json({ success: true, severity: aiSeverity, category: aiCategory });
}
