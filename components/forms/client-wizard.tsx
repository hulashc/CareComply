"use client";

import { useFieldArray, useForm, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, AlertTriangle } from "lucide-react";

import {
  CAPACITY_STATUSES, CLIENT_STATUSES, CLIENT_STEP_FIELDS, FUNDING_SOURCES, MOBILITY_LEVELS,
  RISK_FLAG_KEYS, clientProfileDefaults, clientProfileSchema, type ClientProfileValues,
} from "@/lib/schemas/client-profile";
import { Button } from "@/components/ui/button";
import { FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Wizard } from "./wizard";
import { AreaField, CheckField, Grid, SectionTitle, SelectField, TagField, TextField } from "./fields";

const label = (v: string) => v.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const opts = (values: readonly string[]) => values.map((v) => [v, label(v)] as const);

const CONTACT_TYPE_OPTIONS = [
  ["next_of_kin", "Next of kin"],
  ["gp", "GP / surgery"],
  ["professional", "Other professional (district nurse, social worker...)"],
  ["lpa", "Lasting power of attorney"],
] as const;

function ContactsStep() {
  const { control } = useFormContext<ClientProfileValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "contacts" });
  return (
    <>
      <SectionTitle title="Contacts and professionals" hint="At least one next of kin with a phone number is required." />
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
            <SelectField name={`contacts.${i}.type`} label="Type" required options={CONTACT_TYPE_OPTIONS} />
            <TextField name={`contacts.${i}.name`} label="Name" required />
            <TextField name={`contacts.${i}.relationship`} label="Relationship / role" />
            <TextField name={`contacts.${i}.phone`} label="Phone" type="tel" placeholder="07700 900000" />
            <TextField name={`contacts.${i}.email`} label="Email" type="email" />
          </Grid>
          <CheckField name={`contacts.${i}.isPrimary`} label="Primary contact" description="Called first in an emergency." />
        </div>
      ))}
      <FormField control={control} name="contacts" render={() => <FormItem><FormMessage /></FormItem>} />
      <Button
        type="button"
        variant="outline"
        className="rounded-xl"
        onClick={() => append({ type: "next_of_kin", name: "", relationship: "", phone: "", email: "", isPrimary: false })}
      >
        <Plus className="mr-1 h-4 w-4" /> Add contact
      </Button>
    </>
  );
}

export type CarerOption = { id: string; full_name: string };

export function ClientWizard({
  carers, clientId, initialValues,
}: {
  carers: CarerOption[];
  clientId?: string;
  initialValues?: ClientProfileValues;
}) {
  const form = useForm<ClientProfileValues>({
    resolver: zodResolver(clientProfileSchema),
    defaultValues: initialValues ?? clientProfileDefaults,
    mode: "onTouched",
  });
  const editing = !!clientId;

  const steps = [
    {
      title: "Identity",
      description: "Who the person is and how to reach them.",
      fields: CLIENT_STEP_FIELDS[0] as string[],
      content: (
        <>
          <Grid>
            <SelectField name="title" label="Title" options={[["Mr", "Mr"], ["Mrs", "Mrs"], ["Miss", "Miss"], ["Ms", "Ms"], ["Mx", "Mx"], ["Dr", "Dr"]]} />
            <TextField name="fullName" label="Full legal name" required autoComplete="off" />
            <TextField name="preferredName" label="Preferred name" description="What they like to be called." />
            <TextField name="pronouns" label="Pronouns" placeholder="she/her, he/him, they/them" />
            <SelectField name="gender" label="Gender" options={[["female", "Female"], ["male", "Male"], ["non_binary", "Non-binary"], ["other", "Other"], ["prefer_not_to_say", "Prefer not to say"]]} />
            <TextField name="dob" label="Date of birth" type="date" required />
            <TextField name="nhsNumber" label="NHS number" placeholder="943 476 5919" description="10 digits. The check digit is validated." />
            <TextField name="phone" label="Phone" type="tel" />
          </Grid>
          <SectionTitle title="Home address" />
          <Grid>
            <TextField name="address" label="Address" required className="sm:col-span-2" />
            <TextField name="postcode" label="Postcode" required placeholder="SW1A 1AA" />
            <SelectField name="status" label="Status" required options={opts(CLIENT_STATUSES)} />
          </Grid>
        </>
      ),
    },
    {
      title: "Contacts",
      description: "Next of kin, GP and other professionals involved in their care.",
      fields: CLIENT_STEP_FIELDS[1] as string[],
      content: <ContactsStep />,
    },
    {
      title: "Health and risk",
      description: "Clinical needs and risks carers must know before a visit.",
      fields: CLIENT_STEP_FIELDS[2] as string[],
      content: (
        <>
          <TagField name="conditions" label="Medical conditions" placeholder="e.g. Type 2 diabetes, then Enter" />
          <TagField name="allergies" label="Allergies" description="Drug, food and environmental. Shown prominently on the client record." />
          <Grid>
            <SelectField name="mobilityLevel" label="Mobility" options={opts(MOBILITY_LEVELS)} />
            <TextField name="dietaryNeeds" label="Dietary needs" placeholder="Diabetic, soft diet, halal..." />
          </Grid>
          <AreaField name="communicationNeeds" label="Communication needs" placeholder="Hearing aids, sight loss, dementia, preferred way to communicate..." />
          <SectionTitle title="Risk flags" hint="Tick everything that applies. These feed risk assessments." />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {RISK_FLAG_KEYS.map(([key, text]) => (
              <CheckField key={key} name={`riskFlags.${key}`} label={text} />
            ))}
          </div>
          <CheckField name="dnacpr" label="DNACPR in place" description="Do Not Attempt Cardiopulmonary Resuscitation. Upload the form as a document." />
          <AreaField name="careNotes" label="Additional care notes" />
        </>
      ),
    },
    {
      title: "Legal and funding",
      description: "Capacity, consent and how care is funded.",
      fields: CLIENT_STEP_FIELDS[3] as string[],
      content: (
        <>
          <SelectField name="capacityStatus" label="Mental capacity (MCA 2005)" required options={opts(CAPACITY_STATUSES)} />
          <CheckField name="consentToCare" label="Consent to care and treatment given" description="Required unless capacity is lacking, in which case record the best-interests decision in the care plan." />
          <CheckField name="consentToShare" label="Consent to share information with family and professionals" />
          <Grid>
            <TextField name="lpaHolder" label="Lasting power of attorney" placeholder="Name and type (health / finance)" />
            <TextField name="advocate" label="Advocate (IMCA / other)" />
          </Grid>
          <SectionTitle title="Funding" />
          <Grid>
            <SelectField name="fundingSource" label="Funding source" options={opts(FUNDING_SOURCES)} />
            <TextField name="fundingRef" label="Funding / case reference" />
            <TextField name="localAuthority" label="Local authority" />
          </Grid>
        </>
      ),
    },
    {
      title: "Preferences",
      description: "What matters to them, so care is person-centred.",
      fields: CLIENT_STEP_FIELDS[4] as string[],
      content: (
        <>
          <Grid>
            <TextField name="primaryLanguage" label="Main language" />
            <TextField name="religion" label="Religion / beliefs" />
            <TextField name="ethnicity" label="Ethnicity" />
            <SelectField name="keyWorkerId" label="Key worker" options={carers.map((c) => [c.id, c.full_name] as const)} placeholder={carers.length ? "Select a carer" : "No carers yet"} />
          </Grid>
          <CheckField name="interpreterNeeded" label="Interpreter needed" />
          <AreaField name="likes" label="Likes and routines" placeholder="Tea at 7am, Radio 4, gardening..." />
          <AreaField name="dislikes" label="Dislikes" />
          <AreaField name="lifeHistory" label="Life history" description="Career, family, important events. Helps carers build rapport." />
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Do not put key safe codes or door codes in free text that is shared widely. Describe how carers get in.
          </div>
          <AreaField name="accessInstructions" label="Access instructions" placeholder="Where the key safe is, parking, dogs..." />
        </>
      ),
    },
  ];

  return (
    <Wizard
      form={form}
      steps={steps}
      draftKey={editing ? undefined : "carecomply:client-draft"}
      submitLabel={editing ? "Save changes" : "Add client"}
      successMessage={editing ? "Client updated" : "Client added successfully"}
      cancelHref={editing ? `/dashboard/clients/${clientId}` : "/dashboard/clients"}
      submit={async (values) => {
        const res = await fetch(editing ? `/api/clients/${clientId}` : "/api/clients", {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: data.error ?? "Something went wrong", issues: data.issues };
        return { ok: true, redirectTo: editing ? `/dashboard/clients/${clientId}` : `/dashboard/clients/${data.id}` };
      }}
    />
  );
}
