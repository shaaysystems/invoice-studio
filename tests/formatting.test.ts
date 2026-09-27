import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  amountToWordsINR,
  formatINR,
  formatInvoiceDate,
  formatPercent,
  formatQuantity,
  todayISO,
} from "@/lib/formatting/inr";
import { rupeesToMinor } from "@/lib/money";

describe("formatINR", () => {
  it("uses Indian digit grouping", () => {
    // Rs 1,234,567.89 groups as 12,34,567.89 — not the western 1,234,567.89.
    expect(formatINR(123_456_789)).toBe("₹12,34,567.89");
    expect(formatINR(12_345_678)).toBe("₹1,23,456.78");
    expect(formatINR(100_000)).toBe("₹1,000.00");
  });

  it("always shows two decimals", () => {
    expect(formatINR(100_000)).toBe("₹1,000.00");
    expect(formatINR(1)).toBe("₹0.01");
  });

  it("honours the symbol option for the PDF fallback", () => {
    expect(formatINR(100_000, { symbol: "Rs. " })).toBe("Rs. 1,000.00");
  });

  it("handles zero without a negative or NaN artefact", () => {
    expect(formatINR(0)).toBe("₹0.00");
  });
});

describe("formatQuantity", () => {
  it("drops trailing zeros on a whole number", () => {
    expect(formatQuantity(2)).toBe("2");
  });

  it("keeps meaningful decimals", () => {
    expect(formatQuantity(2.5)).toBe("2.5");
    expect(formatQuantity(1.25)).toBe("1.25");
  });

  it("trims noise like 1.500", () => {
    expect(formatQuantity(1.5)).toBe("1.5");
  });
});

describe("formatPercent", () => {
  it("renders whole rates without a decimal tail", () => {
    expect(formatPercent(18)).toBe("18%");
    expect(formatPercent(0)).toBe("0%");
  });

  it("keeps fractional rates", () => {
    expect(formatPercent(12.5)).toBe("12.5%");
  });
});

describe("formatInvoiceDate", () => {
  it("formats a long date", () => {
    expect(formatInvoiceDate("2026-04-15", "long")).toMatch(/2026/);
  });

  it("formats a short date", () => {
    expect(formatInvoiceDate("2026-04-15", "short")).toMatch(/2026/);
  });

  it("does not throw on an empty value", () => {
    expect(() => formatInvoiceDate("", "long")).not.toThrow();
  });
});

describe("todayISO / addDaysISO", () => {
  it("returns a plain YYYY-MM-DD string", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("adds days across a month boundary", () => {
    expect(addDaysISO("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("handles a leap day", () => {
    expect(addDaysISO("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("accepts a negative offset", () => {
    expect(addDaysISO("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("amountToWordsINR", () => {
  it("writes a small amount", () => {
    expect(amountToWordsINR(rupeesToMinor(1)).toUpperCase()).toContain("ONE");
  });

  it("includes the rupee unit", () => {
    expect(amountToWordsINR(rupeesToMinor(250))).toMatch(/RUPEE/i);
  });

  it("writes zero without crashing", () => {
    expect(amountToWordsINR(0)).toMatch(/ZERO/i);
  });

  it("handles a large amount", () => {
    expect(() => amountToWordsINR(rupeesToMinor(9_87_654_321))).not.toThrow();
  });
});
