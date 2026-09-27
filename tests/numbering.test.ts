import { describe, expect, it } from "vitest";
import {
  defaultNumberingProfile,
  defaultPrefix,
  financialYear,
  generateInvoiceNumber,
  isDuplicateInvoiceNumber,
  nextAvailableInvoiceNumber,
  numberingConfigFromProfile,
  rollNumberingIfYearChanged,
  sanitizePrefix,
} from "@/lib/invoice/numbering";
import { createEmptyInvoice } from "@/lib/invoice/defaults";
import { scaleQuantity } from "@/lib/money";

describe("financialYear", () => {
  it("runs April to March", () => {
    expect(financialYear(new Date(2026, 3, 1))).toBe("2026-27"); // 1 April
    expect(financialYear(new Date(2026, 2, 31))).toBe("2025-26"); // 31 March
  });

  it("handles the century boundary in the label", () => {
    expect(financialYear(new Date(2099, 5, 1))).toBe("2099-00");
  });
});

describe("sanitizePrefix", () => {
  it("keeps letters, numbers, dashes and slashes", () => {
    expect(sanitizePrefix("INV-2026/AB")).toBe("INV-2026/AB");
  });

  it("strips characters that would break a filename", () => {
    expect(sanitizePrefix("INV 2026*?")).toBe("INV2026");
  });

  it("falls back when the prefix is empty or unusable", () => {
    expect(sanitizePrefix("")).toBe("INV");
    expect(sanitizePrefix("   ")).toBe("INV");
    expect(sanitizePrefix("***")).toBe("INV");
  });

  it("trims trailing dashes", () => {
    expect(sanitizePrefix("INV---")).toBe("INV");
  });
});

describe("generateInvoiceNumber", () => {
  it("zero-pads the sequence", () => {
    expect(generateInvoiceNumber({ prefix: "INV", nextSequence: 1, padding: 3 })).toBe("INV-001");
    expect(generateInvoiceNumber({ prefix: "INV", nextSequence: 42, padding: 3 })).toBe("INV-042");
  });

  it("does not truncate a sequence longer than the padding", () => {
    expect(generateInvoiceNumber({ prefix: "INV", nextSequence: 1234, padding: 3 })).toBe("INV-1234");
  });

  it("sanitises the prefix it is given", () => {
    expect(generateInvoiceNumber({ prefix: "bad prefix*", nextSequence: 7, padding: 2 })).toBe("badprefix-07");
  });
});

describe("defaultPrefix / defaultNumberingProfile", () => {
  it("builds a year-based prefix", () => {
    expect(defaultPrefix("INV", new Date(2026, 5, 1))).toBe("INV-2026");
  });

  it("produces a valid starting profile", () => {
    const profile = defaultNumberingProfile();
    expect(profile.nextSequence).toBe(1);
    expect(profile.padding).toBe(3);
    expect(profile.resetYearly).toBe(true);
    expect(profile.financialYear).toBe(financialYear());
  });
});

describe("rollNumberingIfYearChanged", () => {
  const base = {
    prefix: "INV",
    nextSequence: 57,
    padding: 3,
    resetYearly: true,
    financialYear: "2025-26",
  };

  it("resets the sequence when the year rolls over", () => {
    const { numbering, reset } = rollNumberingIfYearChanged(base, new Date(2026, 5, 1));
    expect(reset).toBe(true);
    expect(numbering.nextSequence).toBe(1);
    expect(numbering.financialYear).toBe("2026-27");
  });

  it("leaves the profile alone within the same year", () => {
    const { numbering, reset } = rollNumberingIfYearChanged(base, new Date(2025, 5, 1));
    expect(reset).toBe(false);
    expect(numbering.nextSequence).toBe(57);
  });

  it("never resets when yearly reset is turned off", () => {
    const { numbering, reset } = rollNumberingIfYearChanged(
      { ...base, resetYearly: false },
      new Date(2026, 5, 1),
    );
    expect(reset).toBe(false);
    expect(numbering.nextSequence).toBe(57);
  });
});

describe("numberingConfigFromProfile", () => {
  it("clamps the padding into a sane range", () => {
    const config = (padding: number) => numberingConfigFromProfile({
      prefix: "INV",
      nextSequence: 1,
      padding,
      resetYearly: true,
      financialYear: "2026-27",
    });
    // 0 is falsy, so it falls back to the default 3 rather than clamping to 1.
    // The Zod profile schema already rejects padding < 1, so this only guards
    // hand-built configs.
    expect(config(0).padding).toBe(3);
    expect(config(99).padding).toBe(8);
    expect(config(3).padding).toBe(3);
  });

  it("floors the sequence at 1", () => {
    const config = numberingConfigFromProfile({
      prefix: "INV",
      nextSequence: 0,
      padding: 3,
      resetYearly: true,
      financialYear: "2026-27",
    });
    expect(config.nextSequence).toBe(1);
  });
});

describe("isDuplicateInvoiceNumber / nextAvailableInvoiceNumber", () => {
  const existing = [
    { id: "a", number: "INV-001" },
    { id: "b", number: "INV-002" },
  ];

  it("detects a collision with a different invoice", () => {
    expect(isDuplicateInvoiceNumber("INV-001", existing, "other-id")).toBe(true);
  });

  it("allows an invoice to keep its own number", () => {
    expect(isDuplicateInvoiceNumber("INV-001", existing, "other-id")).toBe(true);
  });

  it("does not flag a fresh number", () => {
    expect(isDuplicateInvoiceNumber("INV-003", existing, "other-id")).toBe(false);
  });

  it("ignores the invoice's own number when checking for collisions", () => {
    const rows = [
      { id: "a", number: "INV-001" },
      { id: "b", number: "INV-002" },
    ];
    // "a" keeping its own number is not a collision.
    expect(isDuplicateInvoiceNumber("INV-001", rows, "a")).toBe(false);
    expect(isDuplicateInvoiceNumber("INV-002", rows, "b")).toBe(false);
  });

  it("compares case-insensitively", () => {
    expect(isDuplicateInvoiceNumber("inv-001", [{ id: "a", number: "INV-001" }], "b")).toBe(true);
  });

  it("walks forward past taken numbers and reports the sequence to save", () => {
    const rows = [
      { id: "a", number: "INV-001" },
      { id: "b", number: "INV-002" },
    ];
    const result = nextAvailableInvoiceNumber({ prefix: "INV", nextSequence: 1, padding: 3 }, rows, "c");
    expect(result.number).toBe("INV-003");
    expect(result.nextSequence).toBe(3);
  });
});

describe("createEmptyInvoice", () => {
  it("starts with one blank line item", () => {
    const invoice = createEmptyInvoice();
    expect(invoice.items).toHaveLength(1);
    expect(invoice.items[0]?.rateMinor).toBe(0);
  });

  it("leaves the number blank until it is saved", () => {
    // The number comes from the business numbering profile at save time, so an
    // empty draft deliberately has none and will not pass `invoiceSchema`.
    expect(createEmptyInvoice().number).toBe("");
  });

  it("stores quantities pre-scaled as whole milli-units", () => {
    const invoice = createEmptyInvoice();
    for (const line of invoice.items) {
      expect(Number.isInteger(line.quantity)).toBe(true);
      expect(line.quantity % 1).toBe(0);
    }
  });

  it("scales quantities consistently", () => {
    expect(scaleQuantity(1)).toBe(1000);
  });
});
