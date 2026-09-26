import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateStripeCustomer } from "@/lib/services/subscription-service";

export async function POST(req: NextRequest) {
  let body: { userId?: string; orgName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const supabaseAuth = await createClient();
  const { data: authData } = await supabaseAuth.auth.getUser();
  const sessionUserId = authData.user?.id;

  if (!sessionUserId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (body.userId !== sessionUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("admins")
    .select("id, org_id")
    .eq("id", sessionUserId)
    .maybeSingle();

  if (existing?.org_id) {
    return NextResponse.json({ error: "Already onboarded" }, { status: 409 });
  }

  const orgName = body.orgName;

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name: orgName || "My Care Home", subscription_status: "active" })
    .select()
    .single();

  if (orgError) return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
  if (!org) return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });

  const { error: adminError } = await supabase
    .from("admins")
    .insert({ id: sessionUserId, org_id: org.id, role: "owner", full_name: "Admin" });

  if (adminError) return NextResponse.json({ error: "Failed to create admin" }, { status: 500 });

  try {
    await getOrCreateStripeCustomer(org.id, org.name);
  } catch {
    console.error("Failed to create Stripe customer during onboarding for org:", org.id);
  }

  return NextResponse.json({ success: true });
}
