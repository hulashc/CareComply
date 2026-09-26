import { describe, it, expect } from "vitest";
import { carerSchema } from "./carer";

describe("carerSchema", () => {
  it("accepts valid carer data", () => {
    const result = carerSchema.safeParse({
      fullName: "Jane Smith",
      email: "jane@example.com",
      phone: "07700900000",
      role: "carer",
      startDate: "2024-01-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty full name", () => {
    const result = carerSchema.safeParse({ fullName: "", role: "carer", startDate: "2024-01-01" });
    expect(result.success).toBe(false);
  });

  it("allows optional fields to be empty", () => {
    const result = carerSchema.safeParse({
      fullName: "Jane Smith",
      email: "",
      phone: "",
      role: "carer",
      startDate: "2024-01-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = carerSchema.safeParse({
      fullName: "Jane Smith",
      email: "not-an-email",
      role: "carer",
      startDate: "2024-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid role", () => {
    const result = carerSchema.safeParse({
      fullName: "Jane Smith",
      role: "superhero",
      startDate: "2024-01-01",
    });
    expect(result.success).toBe(false);
  });
});
