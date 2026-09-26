import { z } from "zod";

export const carerSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Enter a valid email").or(z.literal("")),
  phone: z
    .string()
    .regex(/^[0-9+\s-]{7,15}$/, "Enter a valid phone number")
    .or(z.literal("")),
  role: z.enum(["carer", "senior_carer", "manager"]),
  startDate: z.string().min(1, "Start date is required"),
  notes: z.string().max(500, "Notes must be under 500 characters").optional(),
});

export type CarerFormValues = z.infer<typeof carerSchema>;