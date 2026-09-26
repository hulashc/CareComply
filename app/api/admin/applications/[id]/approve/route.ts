import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/services/auth-guard";
import { sendApprovalEmail } from "@/lib/services/notification-service";
import { sendCarerWelcomeEmail } from "@/lib/services/notification-service";
import { CATEGORY_TO_DOC_TYPE } from "@/lib/utils";
import { logAudit } from "@/lib/services/audit-service";
import { randomBytes } from "crypto";
import type { Tables, TablesInsert } from "@/lib/database.types";
import { rateLimit } from "@/lib/rate-limit";
import { dispatchJob } from "@/lib/jobs/queue";

type ApplicationRow = Tables<"applications">;
type ApplicationDocRow = Tables<"application_documents">;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const currentAdmin = await getCurrentAdmin();
  if (!currentAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const rl = await rateLimit(`approve-application:${currentAdmin.id}`, 10);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const adminClient = createAdminClient();

  const { data: application, error: appErr } = await adminClient
    .from("applications")
    .select("id, status, email, full_name, org_id, phone, national_insurance_number")
    .eq("id", id)
    .eq("org_id", currentAdmin.org_id ?? "")
    .maybeSingle();

  if (appErr || !application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  if (application.org_id !== currentAdmin.org_id) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const { data: claimed } = await adminClient
    .from("applications")
    .update({ status: "approving" })
    .eq("id", id)
    .eq("org_id", currentAdmin.org_id ?? "")
    .eq("status", "pending_review")
    .select("id")
    .maybeSingle();

  if (!claimed) {
    return NextResponse.json({ error: "Application already processed" }, { status: 409 });
  }

  const { data: carer, error: carerError } = await adminClient
    .from("carers")
    .insert({
      org_id: currentAdmin.org_id,
      full_name: application.full_name,
      email: application.email,
      phone: application.phone,
      role: "carer",
      start_date: new Date().toISOString().split("T")[0],
      notes: `Onboarded via application. NI: ${application.national_insurance_number || "N/A"}`,
    } as TablesInsert<"carers">)
    .select()
    .single();

  if (carerError || !carer) {
    return NextResponse.json({ error: "Failed to create carer" }, { status: 500 });
  }

  let authUserId: string | null = null;
  if (application.email) {
    try {
      const randomPassword = randomBytes(16).toString("hex");
      const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
        email: application.email,
        password: randomPassword,
        email_confirm: true,
        user_metadata: { full_name: application.full_name, role: "carer" },
      });
      if (!authError && authUser?.user) {
        authUserId = authUser.user.id;
        await adminClient.from("carers").update({ auth_id: authUserId }).eq("id", carer.id);
        const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/update-password`;
        await adminClient.auth.resetPasswordForEmail(application.email, { redirectTo });
        sendCarerWelcomeEmail(application.email, application.full_name, redirectTo).catch(() => {});
      }
    } catch {
      console.error("[Approve] Failed to create auth user");
    }
  }

  const { data: documents } = await adminClient
    .from("application_documents")
    .select("*")
    .eq("application_id", id)
    .returns<ApplicationDocRow[]>();

  if (documents && documents.length > 0) {
    for (const doc of documents) {
      const typeName = CATEGORY_TO_DOC_TYPE[doc.document_category] || "Other Document";

      let { data: docType } = await adminClient
        .from("document_types")
        .select("id")
        .eq("name", typeName)
        .single();

      if (!docType) {
        const { data: newType } = await adminClient
          .from("document_types")
          .insert({ name: typeName })
          .select()
          .single();
        docType = newType;
      }

      const { data: newDoc } = await adminClient.from("documents").insert({
        org_id: currentAdmin.org_id,
        owner_id: carer.id,
        document_type_id: docType?.id ?? null,
        expiry_date: null,
        status: "amber",
        file_path: doc.file_path,
        owner_type: "carer",
      } as TablesInsert<"documents">).select("id").maybeSingle();

      if (newDoc) {
        dispatchJob("ai:document_ocr", {
          documentId: newDoc.id,
          bucket: "applicant-documents",
          filePath: doc.file_path,
          mimeType: doc.mime_type,
          applicantName: application.full_name,
        }).catch(() => {});
      }
    }
  }

  await adminClient
    .from("applications")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", currentAdmin.org_id ?? "");

  sendApprovalEmail(application.email, application.full_name).catch(() => {});
  logAudit({ action: "application_approved", entityType: "application", entityId: id, actorId: currentAdmin.id, orgId: currentAdmin.org_id, details: `Approved ${application.full_name}` }).catch(() => {});

  return NextResponse.json({ success: true, carerId: carer.id });
}
