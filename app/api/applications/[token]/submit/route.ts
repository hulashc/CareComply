import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applicationSchema } from "@/lib/schemas/application";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const ip = req.headers.get("x-forwarded-for") || token;
  const rl = await rateLimit(`submit:${ip}`, 5);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const adminClient = createAdminClient();
  const body = await req.json();

  const parsed = applicationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid form data", details: parsed.error.flatten() }, { status: 400 });
  }

  const { data: application } = await adminClient
    .from("applications")
    .select("id, status")
    .eq("invite_token", token)
    .maybeSingle();

  if (!application) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  if (application.status !== "invited") {
    return NextResponse.json({ error: "Application has already been submitted" }, { status: 410 });
  }

  const values = parsed.data;

  const { error } = await adminClient
    .from("applications")
    .update({
      full_name: values.fullName,
      address: values.address,
      postcode: values.postcode,
      phone: values.phone,
      email: values.email || null,
      date_of_birth: values.dateOfBirth,
      national_insurance_number: values.nationalInsuranceNumber,
      right_to_work_uk: values.rightToWorkUk === "yes",
      is_uk_eea_citizen: values.isUkEeaCitizen === "yes",
      is_sponsored_visa: values.isSponsoredVisa === "yes",
      visa_status: values.visaStatus || null,
      visa_number: values.visaNumber || null,
      sharecode: values.sharecode || null,
      country_of_origin: values.countryOfOrigin || null,
      student_visa_term_dates: values.studentVisaTermDates || null,
      bank_account_name: values.bankAccountName,
      bank_account_number: values.bankAccountNumber,
      bank_sort_code: values.bankSortCode,
      has_driving_licence: values.hasDrivingLicence === "yes",
      driving_licence_expiry: values.drivingLicenceExpiry || null,
      next_of_kin_name: values.nextOfKinName,
      next_of_kin_phone: values.nextOfKinPhone,
      next_of_kin_relationship: values.nextOfKinRelationship,
      referee_1_name: values.referee1Name,
      referee_1_relationship: values.referee1Relationship,
      referee_1_contact: values.referee1Contact,
      referee_2_name: values.referee2Name,
      referee_2_relationship: values.referee2Relationship,
      referee_2_contact: values.referee2Contact,
      has_convictions_to_disclose: values.hasConvictionsToDisclose === "yes",
      conviction_details: values.convictionDetails || null,
      consents_to_dbs_check: values.consentsToDbsCheck,
      signature_typed_name: values.signatureTypedName,
      declaration_accepted: values.declarationAccepted,
      status: "pending_review",
      submitted_at: new Date().toISOString(),
    })
    .eq("invite_token", token);

  if (error) {
    return NextResponse.json({ error: "Failed to submit application" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
