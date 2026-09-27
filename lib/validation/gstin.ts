const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Structural + checksum validation of an Indian GSTIN. */
export function validateGSTIN(raw: string): boolean {
  const value = (raw || "").trim().toUpperCase();
  if (value.length !== 15 || !GSTIN_RE.test(value)) return false;

  const stateCode = Number(value.slice(0, 2));
  if (stateCode < 1 || stateCode > 38) return false;

  // Official Mod-36 weighted checksum.
  let sum = 0;
  for (let i = 0; i < 14; i += 1) {
    const codePoint = GSTIN_CHARS.indexOf(value[i] as string);
    if (codePoint < 0) return false;
    const factor = i % 2 === 0 ? 1 : 2;
    const product = codePoint * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }
  const checkDigit = GSTIN_CHARS[(36 - (sum % 36)) % 36];
  return checkDigit === value[14];
}

export function panFromGSTIN(gstin: string): string {
  return validateGSTIN(gstin) ? gstin.slice(2, 12) : "";
}

export function stateCodeFromGSTIN(gstin: string): string {
  return gstin && gstin.length >= 2 ? gstin.slice(0, 2) : "";
}

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const validatePAN = (v: string) => PAN_RE.test((v || "").trim().toUpperCase());

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const validateIFSC = (v: string) => IFSC_RE.test((v || "").trim().toUpperCase());

const PINCODE_RE = /^[1-9][0-9]{5}$/;
export const validatePincode = (v: string) => PINCODE_RE.test((v || "").trim());

const UPI_RE = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z][a-zA-Z0-9.\-_]{1,64}$/;
export const validateUPI = (v: string) => UPI_RE.test((v || "").trim());

const PHONE_RE = /^(\+?\d{1,3}[\s-]?)?\d{6,12}$/;
export const validatePhone = (v: string) => PHONE_RE.test((v || "").replace(/[\s()-]/g, ""));
