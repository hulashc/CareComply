import { z } from "zod";

export const clientSchema = z.object({
  fullName: z.string().min(2, "Name is required"),
  dob: z.string().optional(),
  address: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  careNotes: z.string().optional(),
});

export type ClientFormValues = z.infer<typeof clientSchema>;
