import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomBytes } from "crypto";
import type { Tables, TablesInsert } from "@/lib/database.types";
import { CATEGORY_TO_DOC_TYPE } from "@/lib/utils";

type ApplicationRow = Tables<"applications">;

export async function getApplications() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select("*")
    .order("invited_at", { ascending: false })
    .returns<ApplicationRow[]>();
  return data ?? [];
}

export async function getApplicationById(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select("*")
    .eq("id", id)
    .single()
    .returns<ApplicationRow>();
  return data;
}

export async function inviteApplicant(fullName: string, email: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data: admin } = await supabase
    .from("admins")
    .select("org_id")
    .eq("id", userId)
    .single();

  if (!admin?.org_id) throw new Error("Organization not found");

  const token = randomBytes(24).toString("hex");
  const adminClient = createAdminClient();

  const { data: application, error } = await adminClient
    .from("applications")
    .insert({
      org_id: admin.org_id,
      invite_token: token,
      full_name: fullName,
      email: email || null,
      status: "invited",
    } as TablesInsert<"applications">)
    .select()
    .single();

  if (error) throw new Error(error.message);
  if (!application) throw new Error("Failed to create application");

  const link = `${process.env.NEXT_PUBLIC_APP_URL}/apply/${token}`;
  return { application, link };
}

export async function approveApplication(id: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Not authenticated");

  const adminClient = createAdminClient();

  const { data: application } = await adminClient
    .from("applications")
    .select("*")
    .eq("id", id)
    .single()
    .returns<ApplicationRow>();

  if (!application) throw new Error("Application not found");
  if (application.status !== "pending_review") throw new Error("Application is not pending review");

  const { data: carer, error: carerError } = await adminClient
    .from("carers")
    .insert({
      org_id: application.org_id,
      full_name: application.full_name,
      email: application.email,
      phone: application.phone,
      role: "carer",
      start_date: new Date().toISOString().split("T")[0],
      notes: `Onboarded via application. NI: ${application.national_insurance_number || "N/A"}`,
    } as TablesInsert<"carers">)
    .select()
    .single();

  if (carerError || !carer) throw new Error(carerError?.message || "Failed to create carer");

  const { data: docs } = await adminClient
    .from("application_documents")
    .select("*")
    .eq("application_id", id);

  if (docs && docs.length > 0) {
    for (const doc of docs) {
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
      await adminClient.from("documents").insert({
        org_id: application.org_id,
        owner_id: carer.id,
        document_type_id: docType?.id ?? null,
        expiry_date: null,
        status: "amber",
        file_path: doc.file_path,
        owner_type: "carer",
      } as TablesInsert<"documents">);
    }
  }

  await adminClient
    .from("applications")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", id);

  return { carerId: carer.id };
}

export async function rejectApplication(id: string, reason?: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Not authenticated");

  const adminClient = createAdminClient();

  const { data: application } = await adminClient
    .from("applications")
    .select("id, status")
    .eq("id", id)
    .single();

  if (!application) throw new Error("Application not found");
  if (application.status !== "pending_review") throw new Error("Application is not pending review");

  await adminClient
    .from("applications")
    .update({
      status: "rejected",
      rejection_reason: reason || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  return { success: true };
}
