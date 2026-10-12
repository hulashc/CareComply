import { z } from "zod";
import {
  isValidBankAccount, isValidDbsNumber, isValidNiNumber, isValidSortCode,
  isValidUkPhone, isValidUkPostcode,
} from "../validation/uk";

const optionalCheck = (fn: (v: string) => boolean, message: string) =>
  z.string().refine((v) => v.trim() === "" || fn(v), message);

export const CARER_ROLES = ["carer", "senior_carer", "manager"] as const;
export const EMPLOYMENT_TYPES = ["permanent", "fixed_term", "zero_hours", "agency", "bank"] as const;
export const RIGHT_TO_WORK = ["british_irish", "settled_status", "visa", "share_code", "pending"] as const;
export const DBS_LEVELS = ["enhanced", "enhanced_barred"] as const;

export const emergencyContactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  relationship: z.string(),
  phone: z.string().refine(isValidUkPhone, "Enter a valid UK phone number"),
  isPrimary: z.boolean(),
});

export const referenceSchema = z.object({
  name: z.string().min(1, "Referee name is required"),
  organisation: z.string(),
  relationship: z.string(),
  phone: optionalCheck(isValidUkPhone, "Enter a valid UK phone number"),
  email: z.string().email("Enter a valid email").or(z.literal("")),
  received: z.boolean(),
  verified: z.boolean(),
});

export const carerProfileSchema = z
  .object({
    // Step 1: personal
    fullName: z.string().min(2, "Full name is required"),
    email: z.string().email("Enter a valid email"),
    phone: z.string().refine(isValidUkPhone, "Enter a valid UK phone number"),
    dob: z.string().min(1, "Date of birth is required"),
    gender: z.string(),
    address: z.string().min(3, "Address is required"),
    postcode: z.string().refine(isValidUkPostcode, "Enter a valid UK postcode"),
    // Step 2: employment
    role: z.enum(CARER_ROLES),
    startDate: z.string().min(1, "Start date is required"),
    employmentType: z.enum(EMPLOYMENT_TYPES),
    contractHours: z.string().refine((v) => v === "" || (Number(v) >= 0 && Number(v) <= 80), "Hours must be 0-80"),
    payGrade: z.string(),
    probationEnd: z.string(),
    niNumber: optionalCheck(isValidNiNumber, "Invalid National Insurance number"),
    notes: z.string().max(500, "Notes must be under 500 characters"),
    // Step 3: compliance
    rightToWorkStatus: z.enum(RIGHT_TO_WORK),
    rightToWorkExpiry: z.string(),
    dbsNumber: optionalCheck(isValidDbsNumber, "DBS certificate number must be 12 digits"),
    dbsLevel: z.enum(DBS_LEVELS).or(z.literal("")),
    dbsIssueDate: z.string(),
    dbsUpdateService: z.boolean(),
    references: z.array(referenceSchema),
    // Step 4: emergency & fitness
    emergencyContacts: z.array(emergencyContactSchema).min(1, "Add at least one emergency contact"),
    drivingLicence: z.boolean(),
    hasVehicle: z.boolean(),
    vehicleInsured: z.boolean(),
    healthDeclaration: z.string().max(1000),
    // Step 5: bank
    bankAccountName: z.string(),
    sortCode: optionalCheck(isValidSortCode, "Sort code must be 6 digits"),
    accountNumber: optionalCheck(isValidBankAccount, "Account number must be 8 digits"),
  })
  .superRefine((v, ctx) => {
    if (v.rightToWorkStatus === "visa" && !v.rightToWorkExpiry) {
      ctx.addIssue({ code: "custom", path: ["rightToWorkExpiry"], message: "Visa expiry date is required" });
    }
    if (v.dbsNumber && (!v.dbsLevel || !v.dbsIssueDate)) {
      ctx.addIssue({ code: "custom", path: ["dbsLevel"], message: "DBS level and issue date are required with a DBS number" });
    }
    if ((v.sortCode || v.accountNumber) && (!v.sortCode || !v.accountNumber || !v.bankAccountName)) {
      ctx.addIssue({ code: "custom", path: ["accountNumber"], message: "Provide account name, sort code and account number together" });
    }
  });

export type CarerProfileValues = z.infer<typeof carerProfileSchema>;

export const CARER_STEP_FIELDS: (keyof CarerProfileValues)[][] = [
  ["fullName", "email", "phone", "dob", "gender", "address", "postcode"],
  ["role", "startDate", "employmentType", "contractHours", "payGrade", "probationEnd", "niNumber", "notes"],
  ["rightToWorkStatus", "rightToWorkExpiry", "dbsNumber", "dbsLevel", "dbsIssueDate", "dbsUpdateService", "references"],
  ["emergencyContacts", "drivingLicence", "hasVehicle", "vehicleInsured", "healthDeclaration"],
  ["bankAccountName", "sortCode", "accountNumber"],
];

export const carerProfileDefaults: CarerProfileValues = {
  fullName: "", email: "", phone: "", dob: "", gender: "", address: "", postcode: "",
  role: "carer", startDate: "", employmentType: "permanent", contractHours: "", payGrade: "",
  probationEnd: "", niNumber: "", notes: "",
  rightToWorkStatus: "british_irish", rightToWorkExpiry: "", dbsNumber: "", dbsLevel: "",
  dbsIssueDate: "", dbsUpdateService: false, references: [],
  emergencyContacts: [{ name: "", relationship: "", phone: "", isPrimary: true }],
  drivingLicence: false, hasVehicle: false, vehicleInsured: false, healthDeclaration: "",
  bankAccountName: "", sortCode: "", accountNumber: "",
};
