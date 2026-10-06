import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptField } from "@/lib/crypto/field-encryption";
import { normalisePostcode } from "@/lib/validation/uk";
import type { ClientProfileValues } from "@/lib/schemas/client-profile";
import type { CarerProfileValues } from "@/lib/schemas/carer-profile";

/**
 * Untyped admin client: the new profile columns/tables are not in lib/database.types.ts
 * until the 022 migration is applied and `npm run types` is re-run.
 */
export function createProfileDb(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient;
}

const nz = (v: string | undefined | null) => (v && v.trim() !== "" ? v.trim() : null);

export function clientToRow(v: ClientProfileValues) {
  return {
    title: nz(v.title),
    full_name: v.fullName.trim(),
    preferred_name: nz(v.preferredName),
    pronouns: nz(v.pronouns),
    gender: nz(v.gender),
    dob: nz(v.dob),
    nhs_number: nz(v.nhsNumber)?.replace(/\s/g, "") ?? null,
    phone: nz(v.phone),
    address: nz(v.address),
    postcode: normalisePostcode(v.postcode),
    status: v.status,
    conditions: v.conditions,
    allergies: v.allergies,
    mobility_level: nz(v.mobilityLevel),
    communication_needs: nz(v.communicationNeeds),
    dietary_needs: nz(v.dietaryNeeds),
    risk_flags: v.riskFlags,
    dnacpr: v.dnacpr,
    care_notes: nz(v.careNotes),
    capacity_status: v.capacityStatus,
    consent_to_care: v.consentToCare,
    consent_to_share: v.consentToShare,
    lpa_holder: nz(v.lpaHolder),
    advocate: nz(v.advocate),
    funding_source: nz(v.fundingSource),
    funding_ref: nz(v.fundingRef),
    local_authority: nz(v.localAuthority),
    primary_language: nz(v.primaryLanguage),
    interpreter_needed: v.interpreterNeeded,
    religion: nz(v.religion),
    ethnicity: nz(v.ethnicity),
    life_history: nz(v.lifeHistory),
    likes: nz(v.likes),
    dislikes: nz(v.dislikes),
    access_instructions: nz(v.accessInstructions),
    key_worker_id: nz(v.keyWorkerId),
    // Keep legacy single-contact columns populated for older screens.
    emergency_contact_name: v.contacts.find((c) => c.type === "next_of_kin")?.name ?? null,
    emergency_contact_phone: nz(v.contacts.find((c) => c.type === "next_of_kin")?.phone),
  };
}

export function clientContactRows(v: ClientProfileValues, orgId: string, clientId: string) {
  return v.contacts.map((c) => ({
    org_id: orgId,
    client_id: clientId,
    type: c.type,
    name: c.name.trim(),
    relationship: nz(c.relationship),
    phone: nz(c.phone),
    email: nz(c.email),
    is_primary: c.isPrimary,
  }));
}

export function carerToRow(v: CarerProfileValues) {
  const row: Record<string, unknown> = {
    full_name: v.fullName.trim(),
    email: v.email.trim().toLowerCase(),
    phone: nz(v.phone),
    dob: nz(v.dob),
    gender: nz(v.gender),
    address: nz(v.address),
    postcode: normalisePostcode(v.postcode),
    role: v.role,
    start_date: nz(v.startDate),
    employment_type: v.employmentType,
    contract_hours: v.contractHours === "" ? null : Number(v.contractHours),
    pay_grade: nz(v.payGrade),
    probation_end: nz(v.probationEnd),
    notes: nz(v.notes),
    right_to_work_status: v.rightToWorkStatus,
    right_to_work_expiry: nz(v.rightToWorkExpiry),
    dbs_number: nz(v.dbsNumber)?.replace(/\s/g, "") ?? null,
    dbs_level: nz(v.dbsLevel),
    dbs_issue_date: nz(v.dbsIssueDate),
    dbs_update_service: v.dbsUpdateService,
    driving_licence: v.drivingLicence,
    has_vehicle: v.hasVehicle,
    vehicle_insured: v.vehicleInsured,
    health_declaration: nz(v.healthDeclaration),
  };
  if (nz(v.bankAccountName)) row.bank_account_name = nz(v.bankAccountName);
  // Sensitive fields: encrypt before they ever reach the database.
  // On edit, an empty value means "leave unchanged", so the key is omitted.
  if (nz(v.niNumber)) row.ni_number_enc = encryptField(v.niNumber.replace(/\s/g, "").toUpperCase());
  if (nz(v.sortCode)) row.bank_sort_code_enc = encryptField(v.sortCode.replace(/[\s-]/g, ""));
  if (nz(v.accountNumber)) row.bank_account_enc = encryptField(v.accountNumber.replace(/\s/g, ""));
  return row;
}

export function carerChildRows(v: CarerProfileValues, orgId: string, carerId: string) {
  return {
    contacts: v.emergencyContacts.map((c) => ({
      org_id: orgId,
      carer_id: carerId,
      name: c.name.trim(),
      relationship: nz(c.relationship),
      phone: c.phone,
      is_primary: c.isPrimary,
    })),
    references: v.references.map((r) => ({
      org_id: orgId,
      carer_id: carerId,
      name: r.name.trim(),
      organisation: nz(r.organisation),
      relationship: nz(r.relationship),
      phone: nz(r.phone),
      email: nz(r.email),
      received: r.received,
      verified: r.verified,
    })),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const str = (v: unknown) => (v == null ? "" : String(v));

export function rowToClientValues(r: Row, contacts: Row[]): ClientProfileValues {
  return {
    title: str(r.title), fullName: str(r.full_name), preferredName: str(r.preferred_name),
    pronouns: str(r.pronouns), gender: str(r.gender), dob: str(r.dob), nhsNumber: str(r.nhs_number),
    phone: str(r.phone), address: str(r.address), postcode: str(r.postcode), status: r.status ?? "active",
    contacts: contacts.length
      ? contacts.map((c) => ({
          type: c.type, name: str(c.name), relationship: str(c.relationship), phone: str(c.phone),
          email: str(c.email), isPrimary: !!c.is_primary,
        }))
      : [{ type: "next_of_kin", name: "", relationship: "", phone: "", email: "", isPrimary: true }],
    conditions: r.conditions ?? [], allergies: r.allergies ?? [], mobilityLevel: str(r.mobility_level) as ClientProfileValues["mobilityLevel"],
    communicationNeeds: str(r.communication_needs), dietaryNeeds: str(r.dietary_needs),
    riskFlags: r.risk_flags ?? {}, dnacpr: !!r.dnacpr, careNotes: str(r.care_notes),
    capacityStatus: r.capacity_status ?? "not_assessed", consentToCare: !!r.consent_to_care,
    consentToShare: !!r.consent_to_share, lpaHolder: str(r.lpa_holder), advocate: str(r.advocate),
    fundingSource: str(r.funding_source) as ClientProfileValues["fundingSource"], fundingRef: str(r.funding_ref),
    localAuthority: str(r.local_authority), primaryLanguage: str(r.primary_language),
    interpreterNeeded: !!r.interpreter_needed, religion: str(r.religion), ethnicity: str(r.ethnicity),
    lifeHistory: str(r.life_history), likes: str(r.likes), dislikes: str(r.dislikes),
    accessInstructions: str(r.access_instructions), keyWorkerId: str(r.key_worker_id),
  };
}

/** NI number and bank numbers are never sent back to the browser; blank means "unchanged". */
export function rowToCarerValues(r: Row, contacts: Row[], references: Row[]): CarerProfileValues {
  return {
    fullName: str(r.full_name), email: str(r.email), phone: str(r.phone), dob: str(r.dob), gender: str(r.gender),
    address: str(r.address), postcode: str(r.postcode), role: r.role ?? "carer", startDate: str(r.start_date),
    employmentType: r.employment_type ?? "permanent", contractHours: str(r.contract_hours), payGrade: str(r.pay_grade),
    probationEnd: str(r.probation_end), niNumber: "", notes: str(r.notes),
    rightToWorkStatus: r.right_to_work_status ?? "british_irish", rightToWorkExpiry: str(r.right_to_work_expiry),
    dbsNumber: str(r.dbs_number), dbsLevel: str(r.dbs_level) as CarerProfileValues["dbsLevel"],
    dbsIssueDate: str(r.dbs_issue_date), dbsUpdateService: !!r.dbs_update_service,
    references: references.map((x) => ({
      name: str(x.name), organisation: str(x.organisation), relationship: str(x.relationship),
      phone: str(x.phone), email: str(x.email), received: !!x.received, verified: !!x.verified,
    })),
    emergencyContacts: contacts.length
      ? contacts.map((c) => ({ name: str(c.name), relationship: str(c.relationship), phone: str(c.phone), isPrimary: !!c.is_primary }))
      : [{ name: "", relationship: "", phone: "", isPrimary: true }],
    drivingLicence: !!r.driving_licence, hasVehicle: !!r.has_vehicle, vehicleInsured: !!r.vehicle_insured,
    healthDeclaration: str(r.health_declaration), bankAccountName: "", sortCode: "", accountNumber: "",
  };
}
