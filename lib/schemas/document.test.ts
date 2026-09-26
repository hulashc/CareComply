import { describe, it, expect } from "vitest";
import { documentSchema } from "./document";
import { clientSchema } from "./client";

describe("documentSchema", () => {
  it("accepts valid document data", () => {
    const result = documentSchema.safeParse({
      ownerId: "abc-123",
      documentTypeId: "def-456",
      expiryDate: "2025-12-31",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty owner", () => {
    const result = documentSchema.safeParse({ ownerId: "", documentTypeId: "def-456", expiryDate: "2025-12-31" });
    expect(result.success).toBe(false);
  });
});

describe("clientSchema", () => {
  it("accepts valid client data", () => {
    const result = clientSchema.safeParse({
      fullName: "John Smith",
      dob: "1945-03-15",
      address: "456 Care Home Lane",
      emergencyContactName: "Jane Smith",
      emergencyContactPhone: "07700900000",
      careNotes: "Dementia, requires assistance with mobility",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = clientSchema.safeParse({ fullName: "" });
    expect(result.success).toBe(false);
  });

  it("accepts minimal client data", () => {
    const result = clientSchema.safeParse({ fullName: "John Smith" });
    expect(result.success).toBe(true);
  });
});
