/** UK-specific identifier validators. All accept already-trimmed or spaced input. */

export function isValidNhsNumber(value: string): boolean {
  const digits = value.replace(/[\s-]/g, "");
  if (!/^\d{10}$/.test(digits)) return false;
  const sum = digits
    .slice(0, 9)
    .split("")
    .reduce((acc, d, i) => acc + Number(d) * (10 - i), 0);
  let check = 11 - (sum % 11);
  if (check === 11) check = 0;
  if (check === 10) return false;
  return check === Number(digits[9]);
}

const NI_RE = /^(?!BG|GB|KN|NK|NT|TN|ZZ)[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]\d{6}[A-D]$/;
export function isValidNiNumber(value: string): boolean {
  return NI_RE.test(value.replace(/\s/g, "").toUpperCase());
}

const POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/;
export function isValidUkPostcode(value: string): boolean {
  return POSTCODE_RE.test(value.trim().toUpperCase());
}

export function isValidSortCode(value: string): boolean {
  return /^\d{6}$/.test(value.replace(/[\s-]/g, ""));
}

export function isValidBankAccount(value: string): boolean {
  return /^\d{8}$/.test(value.replace(/\s/g, ""));
}

export function isValidUkPhone(value: string): boolean {
  const v = value.replace(/[\s()-]/g, "");
  return /^(\+44|0044|0)\d{9,10}$/.test(v);
}

/** DBS certificate numbers are 12 digits. */
export function isValidDbsNumber(value: string): boolean {
  return /^\d{12}$/.test(value.replace(/\s/g, ""));
}

export const normalisePostcode = (v: string) => {
  const c = v.replace(/\s/g, "").toUpperCase();
  return c.length > 3 ? `${c.slice(0, -3)} ${c.slice(-3)}` : c;
};
