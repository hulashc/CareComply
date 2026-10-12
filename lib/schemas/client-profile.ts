import { z } from "zod";
import { isValidNhsNumber, isValidUkPhone, isValidUkPostcode } from "../validation/uk";

const optionalCheck = (fn: (v: string) => boolean, message: string) =>
  z.string().refine((v) => v.trim() === "" || fn(v), message);

export const CLIENT_STATUSES = ["active", "pending", "discharged"] as const;
export const MOBILITY_LEVELS = ["independent", "walking_aid", "wheelchair", "hoist", "bed_bound"] as const;
export const CAPACITY_STATUSES = ["has_capacity", "fluctuating", "lacks_capacity", "not_assessed"] as const;
export const FUNDING_SOURCES = ["self_funded", "local_authority", "nhs_chc", "direct_payment", "other"] as const;
export const CONTACT_TYPES = ["next_of_kin", "gp", "professional", "lpa"] as const;

export const RISK_FLAG_KEYS = [
  ["falls", "Falls risk"],
  ["moving_handling", "Moving & handling"],
  ["safeguarding", "Safeguarding concern"],
  ["lone_working", "Lone-working risk"],
  ["infection", "Infection control"],
  ["pets", "Pets in home"],
  ["smoking", "Smoker / oxygen in home"],
] as const;

export const clientContactSchema = z.object({
  type: z.enum(CONTACT_TYPES),
  name: z.string().min(1, "Name is required"),
  relationship: z.string(),
  phone: optionalCheck(isValidUkPhone, "Enter a valid UK phone number"),
  email: z.string().email("Enter a valid email").or(z.literal("")),
  isPrimary: z.boolean(),
});

export const clientProfileSchema = z
  .object({
    // Step 1: identity
    title: z.string(),
    fullName: z.string().min(2, "Full name is required"),
    preferredName: z.string(),
    pronouns: z.string(),
    gender: z.string(),
    dob: z.string().min(1, "Date of birth is required"),
    nhsNumber: optionalCheck(isValidNhsNumber, "Invalid NHS number (10 digits, check digit failed)"),
    phone: optionalCheck(isValidUkPhone, "Enter a valid UK phone number"),
    address: z.string().min(3, "Address is required"),
    postcode: z.string().refine(isValidUkPostcode, "Enter a valid UK postcode"),
    status: z.enum(CLIENT_STATUSES),
    // Step 2: contacts
    contacts: z.array(clientContactSchema),
    // Step 3: clinical & risk
    conditions: z.array(z.string()),
    allergies: z.array(z.string()),
    mobilityLevel: z.enum(MOBILITY_LEVELS).or(z.literal("")),
    communicationNeeds: z.string(),
    dietaryNeeds: z.string(),
    riskFlags: z.record(z.string(), z.boolean()),
    dnacpr: z.boolean(),
    careNotes: z.string().max(2000),
    // Step 4: legal & funding
    capacityStatus: z.enum(CAPACITY_STATUSES),
    consentToCare: z.boolean(),
    consentToShare: z.boolean(),
    lpaHolder: z.string(),
    advocate: z.string(),
    fundingSource: z.enum(FUNDING_SOURCES).or(z.literal("")),
    fundingRef: z.string(),
    localAuthority: z.string(),
    // Step 5: preferences
    primaryLanguage: z.string(),
    interpreterNeeded: z.boolean(),
    religion: z.string(),
    ethnicity: z.string(),
    lifeHistory: z.string().max(3000),
    likes: z.string().max(1000),
    dislikes: z.string().max(1000),
    accessInstructions: z.string().max(1000),
    keyWorkerId: z.string(),
  })
  .superRefine((v, ctx) => {
    if (!v.contacts.some((c) => c.type === "next_of_kin" && c.phone.trim())) {
      ctx.addIssue({
        code: "custom",
        path: ["contacts"],
        message: "Add at least one next of kin with a phone number",
      });
    }
    if (!v.consentToCare && v.capacityStatus !== "lacks_capacity") {
      ctx.addIssue({
        code: "custom",
        path: ["consentToCare"],
        message: "Record consent to care, or mark capacity as lacking (best-interests decision)",
      });
    }
  });

export type ClientProfileValues = z.infer<typeof clientProfileSchema>;

/** Fields validated on each wizard step. */
export const CLIENT_STEP_FIELDS: (keyof ClientProfileValues)[][] = [
  ["title", "fullName", "preferredName", "pronouns", "gender", "dob", "nhsNumber", "phone", "address", "postcode", "status"],
  ["contacts"],
  ["conditions", "allergies", "mobilityLevel", "communicationNeeds", "dietaryNeeds", "riskFlags", "dnacpr", "careNotes"],
  ["capacityStatus", "consentToCare", "consentToShare", "lpaHolder", "advocate", "fundingSource", "fundingRef", "localAuthority"],
  ["primaryLanguage", "interpreterNeeded", "religion", "ethnicity", "lifeHistory", "likes", "dislikes", "accessInstructions", "keyWorkerId"],
];

export const clientProfileDefaults: ClientProfileValues = {
  title: "", fullName: "", preferredName: "", pronouns: "", gender: "", dob: "",
  nhsNumber: "", phone: "", address: "", postcode: "", status: "active",
  contacts: [{ type: "next_of_kin", name: "", relationship: "", phone: "", email: "", isPrimary: true }],
  conditions: [], allergies: [], mobilityLevel: "", communicationNeeds: "", dietaryNeeds: "",
  riskFlags: {}, dnacpr: false, careNotes: "",
  capacityStatus: "not_assessed", consentToCare: false, consentToShare: false,
  lpaHolder: "", advocate: "", fundingSource: "", fundingRef: "", localAuthority: "",
  primaryLanguage: "English", interpreterNeeded: false, religion: "", ethnicity: "",
  lifeHistory: "", likes: "", dislikes: "", accessInstructions: "", keyWorkerId: "",
};
