import { describe, it, expect } from "vitest";
import { clientProfileSchema, clientProfileDefaults } from "./client-profile";
import { carerProfileSchema, carerProfileDefaults } from "./carer-profile";

const validClient = {
  ...clientProfileDefaults,
  fullName: "John Smith", dob: "1940-01-01", address: "1 High St", postcode: "SW1A 1AA",
  consentToCare: true,
  contacts: [{ type: "next_of_kin" as const, name: "Jane", relationship: "Daughter", phone: "07700900000", email: "", isPrimary: true }],
};

describe("clientProfileSchema", () => {
  it("accepts a valid client", () => {
    expect(clientProfileSchema.safeParse(validClient).success).toBe(true);
  });
  it("requires a next of kin phone", () => {
    expect(clientProfileSchema.safeParse({ ...validClient, contacts: [] }).success).toBe(false);
  });
  it("requires consent unless capacity is lacking", () => {
    expect(clientProfileSchema.safeParse({ ...validClient, consentToCare: false }).success).toBe(false);
    expect(
      clientProfileSchema.safeParse({ ...validClient, consentToCare: false, capacityStatus: "lacks_capacity" }).success,
    ).toBe(true);
  });
  it("rejects a bad NHS number", () => {
    expect(clientProfileSchema.safeParse({ ...validClient, nhsNumber: "9434765918" }).success).toBe(false);
    expect(clientProfileSchema.safeParse({ ...validClient, nhsNumber: "943 476 5919" }).success).toBe(true);
  });
});

const validCarer = {
  ...carerProfileDefaults,
  fullName: "Jane Carer", email: "jane@example.com", phone: "07700900000", dob: "1990-05-05",
  address: "2 Low Rd", postcode: "M1 1AE", startDate: "2026-01-01",
  emergencyContacts: [{ name: "Bob", relationship: "Partner", phone: "07700900001", isPrimary: true }],
};

describe("carerProfileSchema", () => {
  it("accepts a valid carer", () => {
    expect(carerProfileSchema.safeParse(validCarer).success).toBe(true);
  });
  it("requires DBS level and date with a DBS number", () => {
    expect(carerProfileSchema.safeParse({ ...validCarer, dbsNumber: "001234567890" }).success).toBe(false);
    expect(
      carerProfileSchema.safeParse({ ...validCarer, dbsNumber: "001234567890", dbsLevel: "enhanced", dbsIssueDate: "2025-01-01" }).success,
    ).toBe(true);
  });
  it("requires bank fields together", () => {
    expect(carerProfileSchema.safeParse({ ...validCarer, sortCode: "123456" }).success).toBe(false);
  });
  it("requires visa expiry for visa holders", () => {
    expect(carerProfileSchema.safeParse({ ...validCarer, rightToWorkStatus: "visa" }).success).toBe(false);
  });
});
