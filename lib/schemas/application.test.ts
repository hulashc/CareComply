import { describe, it, expect } from "vitest";
import { applicationSchema } from "./application";

describe("applicationSchema", () => {
  const validData = {
    fullName: "John Doe",
    address: "123 High Street",
    postcode: "SW1A 1AA",
    phone: "07700900000",
    email: "john@example.com",
    dateOfBirth: "1990-01-01",
    nationalInsuranceNumber: "AB123456C",
    rightToWorkUk: "yes" as const,
    isUkEeaCitizen: "yes" as const,
    bankAccountName: "John Doe",
    bankAccountNumber: "12345678",
    bankSortCode: "12-34-56",
    hasDrivingLicence: "no" as const,
    nextOfKinName: "Jane Doe",
    nextOfKinPhone: "07700900001",
    nextOfKinRelationship: "Spouse",
    referee1Name: "Ref One",
    referee1Relationship: "Manager",
    referee1Contact: "ref1@example.com",
    referee2Name: "Ref Two",
    referee2Relationship: "Colleague",
    referee2Contact: "ref2@example.com",
    hasConvictionsToDisclose: "no" as const,
    consentsToDbsCheck: true,
    signatureTypedName: "John Doe",
    declarationAccepted: true,
  };

  it("accepts valid application data", () => {
    const result = applicationSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects without DBS consent", () => {
    const result = applicationSchema.safeParse({ ...validData, consentsToDbsCheck: false });
    expect(result.success).toBe(false);
  });

  it("rejects without declaration", () => {
    const result = applicationSchema.safeParse({ ...validData, declarationAccepted: false });
    expect(result.success).toBe(false);
  });

  it("rejects short name", () => {
    const result = applicationSchema.safeParse({ ...validData, fullName: "J" });
    expect(result.success).toBe(false);
  });

  it("rejects short address", () => {
    const result = applicationSchema.safeParse({ ...validData, address: "St" });
    expect(result.success).toBe(false);
  });

  it("accepts with visa details when non-EEA", () => {
    const result = applicationSchema.safeParse({
      ...validData,
      isUkEeaCitizen: "no" as const,
      visaStatus: "Tier 2",
      visaNumber: "123456",
      sharecode: "ABC123",
      countryOfOrigin: "India",
    });
    expect(result.success).toBe(true);
  });
});
