import { describe, it, expect } from "vitest";
import {
  isValidNhsNumber, isValidNiNumber, isValidUkPostcode, isValidSortCode,
  isValidBankAccount, isValidUkPhone, isValidDbsNumber, normalisePostcode,
} from "./uk";

describe("uk validators", () => {
  it("validates NHS numbers with mod-11", () => {
    expect(isValidNhsNumber("943 476 5919")).toBe(true);
    expect(isValidNhsNumber("9434765918")).toBe(false);
    expect(isValidNhsNumber("12345")).toBe(false);
  });
  it("validates NI numbers", () => {
    expect(isValidNiNumber("AB 12 34 56 C")).toBe(true);
    expect(isValidNiNumber("BG123456A")).toBe(false);
    expect(isValidNiNumber("AB123456E")).toBe(false);
  });
  it("validates postcodes", () => {
    expect(isValidUkPostcode("SW1A 1AA")).toBe(true);
    expect(isValidUkPostcode("m11ae")).toBe(true);
    expect(isValidUkPostcode("12345")).toBe(false);
    expect(normalisePostcode("m11ae")).toBe("M1 1AE");
  });
  it("validates bank details", () => {
    expect(isValidSortCode("12-34-56")).toBe(true);
    expect(isValidSortCode("1234")).toBe(false);
    expect(isValidBankAccount("12345678")).toBe(true);
    expect(isValidBankAccount("1234567")).toBe(false);
  });
  it("validates phones and DBS", () => {
    expect(isValidUkPhone("07700 900000")).toBe(true);
    expect(isValidUkPhone("+44 7700 900000")).toBe(true);
    expect(isValidUkPhone("123")).toBe(false);
    expect(isValidDbsNumber("001234567890")).toBe(true);
    expect(isValidDbsNumber("1234")).toBe(false);
  });
});
