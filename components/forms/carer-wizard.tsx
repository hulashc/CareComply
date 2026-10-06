"use client";

import { useFieldArray, useForm, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";

import {
  CARER_STEP_FIELDS, DBS_LEVELS, EMPLOYMENT_TYPES,
  carerProfileDefaults, carerProfileSchema, type CarerProfileValues,
} from "@/lib/schemas/carer-profile";
import { Button } from "@/components/ui/button";
import { FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Wizard } from "./wizard";
import { AreaField, CheckField, Grid, SectionTitle, SelectField, TextField } from "./fields";

const label = (v: string) => v.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const opts = (values: readonly string[]) => values.map((v) => [v, label(v)] as const);

const RTW_OPTIONS = [
  ["british_irish", "British or Irish citizen"],
  ["settled_status", "EU settled / pre-settled status"],
  ["visa", "Visa (e.g. Health and Care Worker)"],
  ["share_code", "Home Office share code"],
  ["pending", "Check pending"],
] as const;

function EmergencyContactsStep() {
  const { control } = useFormContext<CarerProfileValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "emergencyContacts" });
  return (
    <>
      <SectionTitle title="Emergency contacts" />
      {fields.map((f, i) => (
        <div key={f.id} className="space-y-4 rounded-xl border border-border/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Contact {i + 1}</span>
            {fields.length > 1 && (
              <Button type="button" variant="ghost" size="sm" aria-label={`Remove contact ${i + 1}`} onClick={() => remove(i)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Grid>
            <TextField name={`emergencyContacts.${i}.name`} label="Name" required />
            <TextField name={`emergencyContacts.${i}.relationship`} label="Relationship" />
            <TextField name={`emergencyContacts.${i}.phone`} label="Phone" type="tel" required />
          </Grid>
          <CheckField name={`emergencyContacts.${i}.isPrimary`} label="Primary contact" />
        </div>
      ))}
      <FormField control={control} name="emergencyContacts" render={() => <FormItem><FormMessage /></FormItem>} />
      <Button type="button" variant="outline" className="rounded-xl" onClick={() => append({ name: "", relationship: "", phone: "", isPrimary: false })}>
        <Plus className="mr-1 h-4 w-4" /> Add contact
      </Button>
    </>
  );
}

function ReferencesStep() {
  const { control } = useFormContext<CarerProfileValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "references" });
  return (
    <>
      <SectionTitle title="References" hint="Two references covering the last 3 years are expected under Schedule 3 of the Health and Social Care Act regulations." />
      {fields.map((f, i) => (
        <div key={f.id} className="space-y-4 rounded-xl border border-border/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Referee {i + 1}</span>
            <Button type="button" variant="ghost" size="sm" aria-label={`Remove referee ${i + 1}`} onClick={() => remove(i)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <Grid>
            <TextField name={`references.${i}.name`} label="Name" required />
            <TextField name={`references.${i}.organisation`} label="Organisation" />
            <TextField name={`references.${i}.relationship`} label="Relationship" />
            <TextField name={`references.${i}.phone`} label="Phone" type="tel" />
            <TextField name={`references.${i}.email`} label="Email" type="email" />
          </Grid>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CheckField name={`references.${i}.received`} label="Reference received" />
            <CheckField name={`references.${i}.verified`} label="Verified by phone / email" />
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" className="rounded-xl" onClick={() => append({ name: "", organisation: "", relationship: "", phone: "", email: "", received: false, verified: false })}>
        <Plus className="mr-1 h-4 w-4" /> Add referee
      </Button>
    </>
  );
}

export function CarerWizard({ carerId, initialValues }: { carerId?: string; initialValues?: CarerProfileValues }) {
  const form = useForm<CarerProfileValues>({
    resolver: zodResolver(carerProfileSchema),
    defaultValues: initialValues ?? carerProfileDefaults,
    mode: "onTouched",
  });
  const editing = !!carerId;

  const steps = [
    {
      title: "Personal",
      description: "Contact details and home address.",
      fields: CARER_STEP_FIELDS[0] as string[],
      content: (
        <Grid>
          <TextField name="fullName" label="Full legal name" required autoComplete="off" className="sm:col-span-2" />
          <TextField name="email" label="Email" type="email" required />
          <TextField name="phone" label="Mobile phone" type="tel" required placeholder="07700 900000" />
          <TextField name="dob" label="Date of birth" type="date" required />
          <SelectField name="gender" label="Gender" options={[["female", "Female"], ["male", "Male"], ["non_binary", "Non-binary"], ["other", "Other"], ["prefer_not_to_say", "Prefer not to say"]]} />
          <TextField name="address" label="Home address" required className="sm:col-span-2" />
          <TextField name="postcode" label="Postcode" required placeholder="SW1A 1AA" />
        </Grid>
      ),
    },
    {
      title: "Employment",
      description: "Role, contract and payroll identifiers.",
      fields: CARER_STEP_FIELDS[1] as string[],
      content: (
        <>
          <Grid>
            <SelectField name="role" label="Role" required options={[["carer", "Carer"], ["senior_carer", "Senior carer"], ["manager", "Manager"]]} />
            <TextField name="startDate" label="Start date" type="date" required />
            <SelectField name="employmentType" label="Employment type" required options={opts(EMPLOYMENT_TYPES)} />
            <TextField name="contractHours" label="Contracted hours / week" type="number" placeholder="e.g. 37.5" />
            <TextField name="payGrade" label="Pay grade / rate" />
            <TextField name="probationEnd" label="Probation ends" type="date" />
            <TextField name="niNumber" label="National Insurance number" placeholder="AB 12 34 56 C" description="Stored encrypted. Leave blank to keep the existing value." className="sm:col-span-2" />
          </Grid>
          <AreaField name="notes" label="Notes" />
        </>
      ),
    },
    {
      title: "Compliance",
      description: "Right to work, DBS and references.",
      fields: CARER_STEP_FIELDS[2] as string[],
      content: (
        <>
          <SectionTitle title="Right to work" />
          <Grid>
            <SelectField name="rightToWorkStatus" label="Status" required options={RTW_OPTIONS} />
            <TextField name="rightToWorkExpiry" label="Expiry date" type="date" description="Required for visa holders." />
          </Grid>
          <SectionTitle title="DBS check" hint="Care roles require an Enhanced DBS check with the adult barred list." />
          <Grid>
            <TextField name="dbsNumber" label="Certificate number" description="12 digits." />
            <SelectField name="dbsLevel" label="Level" options={opts(DBS_LEVELS)} />
            <TextField name="dbsIssueDate" label="Issue date" type="date" />
          </Grid>
          <CheckField name="dbsUpdateService" label="Registered with the DBS Update Service" />
          <ReferencesStep />
        </>
      ),
    },
    {
      title: "Emergency & fitness",
      description: "Who to contact, driving and health declaration.",
      fields: CARER_STEP_FIELDS[3] as string[],
      content: (
        <>
          <EmergencyContactsStep />
          <SectionTitle title="Driving" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <CheckField name="drivingLicence" label="Full driving licence" />
            <CheckField name="hasVehicle" label="Has own vehicle" />
            <CheckField name="vehicleInsured" label="Business-use insurance" />
          </div>
          <AreaField
            name="healthDeclaration"
            label="Health declaration"
            description="Only record conditions that affect safe working or need reasonable adjustments. This is special-category data."
          />
        </>
      ),
    },
    {
      title: "Payroll",
      description: "Bank details for payroll. Stored encrypted; optional now and can be added later.",
      fields: CARER_STEP_FIELDS[4] as string[],
      content: (
        <Grid>
          <TextField name="bankAccountName" label="Account holder name" className="sm:col-span-2" />
          <TextField name="sortCode" label="Sort code" placeholder="12-34-56" autoComplete="off" />
          <TextField name="accountNumber" label="Account number" placeholder="8 digits" autoComplete="off" />
        </Grid>
      ),
    },
  ];

  return (
    <Wizard
      form={form}
      steps={steps}
      draftKey={editing ? undefined : "carecomply:carer-draft"}
      draftExclude={["niNumber", "sortCode", "accountNumber", "healthDeclaration", "dbsNumber"]}
      maskedKeys={["niNumber", "sortCode", "accountNumber"]}
      submitLabel={editing ? "Save changes" : "Add carer"}
      successMessage={editing ? "Carer updated" : "Carer added successfully"}
      cancelHref={editing ? `/dashboard/carers/${carerId}` : "/dashboard/carers"}
      submit={async (values) => {
        const res = await fetch(editing ? `/api/carers/${carerId}` : "/api/carers", {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: data.error ?? "Something went wrong", issues: data.issues };
        return { ok: true, redirectTo: editing ? `/dashboard/carers/${carerId}` : `/dashboard/carers/${data.id}` };
      }}
    />
  );
}
