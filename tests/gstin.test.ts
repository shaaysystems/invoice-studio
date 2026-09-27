import { describe, expect, it } from "vitest";
import {
  panFromGSTIN,
  stateCodeFromGSTIN,
  validateGSTIN,
  validateIFSC,
  validatePAN,
  validatePhone,
  validatePincode,
  validateUPI,
} from "@/lib/validation/gstin";

describe("validateGSTIN", () => {
  // These carry a real Mod-36 check digit, so they pass the checksum too.
  it("accepts a well-formed GSTIN", () => {
    expect(validateGSTIN("32AAAAA0000A1ZB")).toBe(true);
    expect(validateGSTIN("27AAACA1234A1ZK")).toBe(true);
    expect(validateGSTIN("29AABCK9602R1ZU")).toBe(true);
    expect(validateGSTIN("07AAACT2727Q1ZY")).toBe(true);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(validateGSTIN("  32aaaaa0000a1zb  ")).toBe(true);
  });

  it("rejects the wrong length", () => {
    expect(validateGSTIN("32AAAAA0000A1Z")).toBe(false);
    expect(validateGSTIN("32AAAAA0000A1ZB5")).toBe(false);
    expect(validateGSTIN("")).toBe(false);
  });

  it("rejects an out-of-range state code", () => {
    // State codes run 01-38; 00 and 99 are not valid.
    expect(validateGSTIN("00AAAAA0000A1ZB")).toBe(false);
  });

  it("rejects a wrong check digit", () => {
    // Structurally identical to a valid GSTIN but the checksum fails.
    expect(validateGSTIN("32AAAAA0000A1ZA")).toBe(false);
  });
});

describe("panFromGSTIN", () => {
  it("extracts the embedded PAN (characters 3-12)", () => {
    expect(panFromGSTIN("32AAAAA0000A1ZB")).toBe("AAAAA0000A");
  });

  it("returns an empty string for a blank or invalid GSTIN", () => {
    // The PAN is only trusted once the whole GSTIN checksums correctly.
    expect(panFromGSTIN("")).toBe("");
    expect(panFromGSTIN("32AAAAA0000A1ZA")).toBe("");
  });
});

describe("stateCodeFromGSTIN", () => {
  it("extracts the leading state code", () => {
    expect(stateCodeFromGSTIN("32AAAAA0000A1ZB")).toBe("32");
    expect(stateCodeFromGSTIN("27AAACA1234A1ZK")).toBe("27");
  });

  it("returns an empty string for a blank GSTIN", () => {
    expect(stateCodeFromGSTIN("")).toBe("");
  });
});

describe("validatePAN", () => {
  it("accepts a standard PAN", () => {
    expect(validatePAN("ABCDE1234F")).toBe(true);
  });

  it("is case-insensitive and trims", () => {
    expect(validatePAN(" abcde1234f ")).toBe(true);
  });

  it("rejects the wrong shape", () => {
    expect(validatePAN("ABCDE1234")).toBe(false);
    expect(validatePAN("ABCDE12345F")).toBe(false);
    expect(validatePAN("1BCDE1234F")).toBe(false);
    expect(validatePAN("")).toBe(false);
  });
});

describe("validateIFSC", () => {
  it("accepts a standard IFSC", () => {
    expect(validateIFSC("HDFC0001234")).toBe(true);
    expect(validateIFSC("SBIN0000001")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(validateIFSC("hdfc0001234")).toBe(true);
  });

  it("rejects the wrong length or shape", () => {
    expect(validateIFSC("HDFC000123")).toBe(false);
    expect(validateIFSC("HDFC00012345")).toBe(false);
    expect(validateIFSC("1DFC0001234")).toBe(false);
  });
});

describe("validatePincode", () => {
  it("accepts a 6-digit PIN", () => {
    expect(validatePincode("560001")).toBe(true);
  });

  it("rejects non-6-digit input", () => {
    expect(validatePincode("56000")).toBe(false);
    expect(validatePincode("5600011")).toBe(false);
    expect(validatePincode("56A001")).toBe(false);
  });
});

describe("validateUPI", () => {
  it("accepts a handle@bank UPI ID", () => {
    expect(validateUPI("studio@hdfcbank")).toBe(true);
    expect(validateUPI("a.b@ybl")).toBe(true);
  });

  it("rejects a missing or malformed handle", () => {
    expect(validateUPI("hdfcbank")).toBe(false);
    expect(validateUPI("studio@")).toBe(false);
    expect(validateUPI("@hdfcbank")).toBe(false);
  });
});

describe("validatePhone", () => {
  it("accepts Indian 10-digit numbers", () => {
    expect(validatePhone("9876543210")).toBe(true);
  });

  it("ignores spaces, dashes and brackets", () => {
    expect(validatePhone("+91 98765-43210")).toBe(true);
    expect(validatePhone("(98765) 43210")).toBe(true);
  });

  it("rejects a wrong digit count", () => {
    expect(validatePhone("12345")).toBe(false);
    expect(validatePhone("98765432101234567")).toBe(false);
    expect(validatePhone("not-a-phone")).toBe(false);
  });

  it("tolerates longer international numbers", () => {
    // 6-12 digits is deliberately wider than a strict 10-digit Indian rule.
    expect(validatePhone("98765432101")).toBe(true);
  });
});
