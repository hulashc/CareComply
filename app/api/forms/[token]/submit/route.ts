import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import type { Json } from "@/lib/database.types";
import { rateLimit } from "@/lib/rate-limit";

const MAX_BODY_SIZE = 1024 * 100; // 100KB max

function sanitize(obj: unknown): Json {
  if (obj === null || obj === undefined) return obj as Json;
  if (typeof obj === "string") {
    if (obj.length > 10000) return obj.slice(0, 10000);
    return obj.replace(/<[^>]*>/g, "");
  }
  if (typeof obj === "number" || typeof obj === "boolean") return obj;
  if (Array.isArray(obj)) return obj.map(sanitize).slice(0, 100) as Json[];
  if (typeof obj === "object") {
    const cleaned: Record<string, Json> = {};
    const keys = Object.keys(obj).slice(0, 50);
    for (const key of keys) {
      if (key.startsWith("$") || key.startsWith("__")) continue;
      cleaned[key] = sanitize((obj as Record<string, unknown>)[key]);
    }
    return cleaned;
  }
  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const rl = await rateLimit(`form-submit:${ip}`, 20);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_SIZE) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body format" }, { status: 400 });
  }

  body = sanitize(body);

  const supabase = createAdminClient();

  const { data: link, error: linkError } = await supabase
    .from("form_links")
    .select("*, form_templates(*)")
    .eq("token", token)
    .single();

  if (linkError || !link) {
    return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  }

  if (!link.form_templates) {
    return NextResponse.json({ error: "Form template not found" }, { status: 404 });
  }

  if (link.used) {
    return NextResponse.json({ error: "Already submitted" }, { status: 400 });
  }

  if (new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: "Link expired" }, { status: 400 });
  }

  const ownerType = link.recipient_type === "carer" || link.recipient_type === "admin" ? link.recipient_type : "carer";
  const b = body as Record<string, unknown>;
  const { error: insertError } = await supabase.from("documents").insert({
    org_id: link.form_templates.org_id,
    owner_id: link.recipient_id ?? "",
    owner_type: ownerType,
    document_type_id: null,
    extracted_data: body as Json,
    verified: false,
    expiry_date: typeof b.issue_date === "string" ? b.issue_date : null,
  });

  if (insertError) {
    return NextResponse.json({ error: "Failed to submit form" }, { status: 500 });
  }

  await supabase.from("form_links").update({ used: true }).eq("token", token);

  return NextResponse.json({ success: true });
}
