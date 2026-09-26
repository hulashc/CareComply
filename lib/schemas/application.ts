import { z } from "zod";

export const applicationSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  address: z.string().min(5, "Address is required"),
  postcode: z.string().min(3, "Postcode is required"),
  phone: z.string().min(7, "Phone number is required"),
  email: z.string().email("Enter a valid email").or(z.literal("")),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  nationalInsuranceNumber: z.string().min(1, "NI number is required"),

  rightToWorkUk: z.enum(["yes", "no"]),
  isUkEeaCitizen: z.enum(["yes", "no"]),

  isSponsoredVisa: z.enum(["yes", "no"]).optional(),
  visaStatus: z.string().optional(),
  visaNumber: z.string().optional(),
  sharecode: z.string().optional(),
  countryOfOrigin: z.string().optional(),
  studentVisaTermDates: z.string().optional(),

  bankAccountName: z.string().min(1, "Account name is required"),
  bankAccountNumber: z.string().min(6, "Enter a valid account number"),
  bankSortCode: z.string().min(6, "Enter a valid sort code"),

  hasDrivingLicence: z.enum(["yes", "no"]),
  drivingLicenceExpiry: z.string().optional(),

  nextOfKinName: z.string().min(1, "Required"),
  nextOfKinPhone: z.string().min(1, "Required"),
  nextOfKinRelationship: z.string().min(1, "Required"),

  referee1Name: z.string().min(1, "Required"),
  referee1Relationship: z.string().min(1, "Required"),
  referee1Contact: z.string().min(1, "Required"),
  referee2Name: z.string().min(1, "Required"),
  referee2Relationship: z.string().min(1, "Required"),
  referee2Contact: z.string().min(1, "Required"),

  hasConvictionsToDisclose: z.enum(["yes", "no"]),
  convictionDetails: z.string().optional(),
  consentsToDbsCheck: z.boolean().refine((v) => v === true, "You must consent to a DBS check"),

  signatureTypedName: z.string().min(2, "Type your full name as signature"),
  declarationAccepted: z.boolean().refine((v) => v === true, "You must accept the declaration"),
});

export type ApplicationFormValues = z.infer<typeof applicationSchema>;