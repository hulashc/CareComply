import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const rl = await rateLimit(`form-upload:${ip}`, 20);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const adminClient = createAdminClient();

  const { data: link, error: linkError } = await adminClient
    .from("form_links")
    .select("id, used, expires_at")
    .eq("token", token)
    .single();

  if (linkError || !link) {
    return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  }

  if (link.used) {
    return NextResponse.json({ error: "Already submitted" }, { status: 400 });
  }

  if (new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: "Link expired" }, { status: 400 });
  }

  let formData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File;
  const fieldName = (formData.get("fieldName") as string) || "file";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "File type not allowed. Use PDF, JPEG, or PNG." }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large. Maximum 10MB." }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `forms/${token}/${fieldName}-${Date.now()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await adminClient.storage
    .from("form-files")
    .upload(filePath, buffer, { contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ error: "Upload failed. Ensure the storage bucket exists." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    filePath,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  });
}
