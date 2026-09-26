import { z } from "zod";

export const documentSchema = z.object({
  ownerId: z.string().min(1, "Select a carer"),
  documentTypeId: z.string().min(1, "Select a document type"),
  expiryDate: z.string().min(1, "Expiry date is required"),
});

export type DocumentFormValues = z.infer<typeof documentSchema>;
