import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const ip = req.headers.get("x-forwarded-for") || token;
  const rl = await rateLimit(`upload:${ip}`, 20);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const adminClient = createAdminClient();

  const { data: application } = await adminClient
    .from("applications")
    .select("id, status")
    .eq("invite_token", token)
    .maybeSingle();

  if (!application) {
    return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  }

  if (application.status !== "invited") {
    return NextResponse.json({ error: "Application has already been submitted or reviewed" }, { status: 410 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const category = formData.get("category") as string;

  if (!file || !category) {
    return NextResponse.json({ error: "Missing file or category" }, { status: 400 });
  }

  const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large. Maximum 10MB." }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const filePath = `${token}/${category}-${Date.now()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await adminClient.storage
    .from("applicant-documents")
    .upload(filePath, buffer, { contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }

  const { error: insertError } = await adminClient.from("application_documents").insert({
    application_id: application.id,
    document_category: category,
    file_path: filePath,
    file_name: file.name,
    file_size_bytes: file.size,
    mime_type: file.type,
  });

  if (insertError) {
    return NextResponse.json({ error: "Failed to save document record" }, { status: 500 });
  }

  return NextResponse.json({ success: true, filePath });
}
