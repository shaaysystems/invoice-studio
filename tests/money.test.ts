import { describe, expect, it } from "vitest";
import {
  MINOR_PER_UNIT,
  QTY_SCALE,
  allocateProportionally,
  applyBasisPoints,
  clamp,
  minorToInputValue,
  minorToRupees,
  multiplyQuantityPrice,
  percentToBasisPoints,
  roundHalfUp,
  rupeesToMinor,
  scaleQuantity,
  unscaleQuantity,
} from "@/lib/money";

describe("rupeesToMinor", () => {
  it("converts rupees to paise", () => {
    expect(rupeesToMinor(100)).toBe(10_000);
    expect(rupeesToMinor(0)).toBe(0);
    expect(rupeesToMinor(1)).toBe(MINOR_PER_UNIT);
  });

  it("rounds half up rather than truncating", () => {
    // 0.125 rupees is 12.5 paise and must not truncate to 12.
    expect(rupeesToMinor(0.125)).toBe(13);
  });

  it("defuses binary float artefacts", () => {
    // 10.005 rupees is exactly 1000.5 paise, so half-up gives 1001.
    expect(rupeesToMinor(10.005)).toBe(1001);
    // 1.15 * 100 is 114.99999999999999 in IEEE754; must not truncate to 114.
    expect(rupeesToMinor(1.15)).toBe(115);
    // 8.115 * 100 is 811.4999999999999; the toFixed(6) pass rescues it.
    expect(rupeesToMinor(8.115)).toBe(812);
  });

  it("parses strings from form inputs", () => {
    expect(rupeesToMinor("1,23,456.78")).toBe(12_345_678);
    expect(rupeesToMinor("")).toBe(0);
    expect(rupeesToMinor(null)).toBe(0);
    expect(rupeesToMinor(undefined)).toBe(0);
  });

  it("converts faithfully, leaving sign rejection to validation", () => {
    // A pure converter: negative input stays negative. `rateMinor` is what the
    // Zod schema floors at 0, so there is one guard, not two.
    expect(rupeesToMinor(-50)).toBe(-5000);
  });
});

describe("minorToRupees / minorToInputValue", () => {
  it("round-trips through paise", () => {
    expect(minorToRupees(12_345_678)).toBeCloseTo(123_456.78, 6);
  });

  it("emits a clean string for controlled inputs", () => {
    expect(minorToInputValue(12_345_678)).toBe("123456.78");
    // Whole rupees drop the ".00" noise; an empty input is "" not "0.00".
    expect(minorToInputValue(100)).toBe("1");
    expect(minorToInputValue(0)).toBe("");
  });
});

describe("quantity scaling", () => {
  it("scales by exactly QTY_SCALE", () => {
    expect(scaleQuantity(1)).toBe(QTY_SCALE);
    expect(scaleQuantity(2.5)).toBe(2500);
    expect(scaleQuantity(0.001)).toBe(1);
  });

  it("round-trips", () => {
    for (const q of [0.25, 1, 3.75, 100, 0.333]) {
      expect(unscaleQuantity(scaleQuantity(q))).toBeCloseTo(q, 9);
    }
  });

  it("rounds to the milli precision it stores", () => {
    // Stored precision is 3 decimals, so 1.2345 rounds half up to 1.235.
    expect(scaleQuantity(1.2345)).toBe(1235);
    expect(unscaleQuantity(1235)).toBeCloseTo(1.235, 9);
  });

  it("keeps exact values that fit the stored precision", () => {
    expect(scaleQuantity(1.234)).toBe(1234);
    expect(unscaleQuantity(1234)).toBeCloseTo(1.234, 9);
  });
});

describe("multiplyQuantityPrice", () => {
  it("multiplies scaled quantity by a paise unit price", () => {
    // 2 units at Rs 1,000 => Rs 2,000 => 200_000 paise.
    expect(multiplyQuantityPrice(scaleQuantity(2), 100_000)).toBe(200_000);
  });

  it("is exact for fractional quantities", () => {
    // 1.5 x Rs 999.99 = Rs 1,499.985 => rounds to 149_999 paise.
    expect(multiplyQuantityPrice(scaleQuantity(1.5), 99_999)).toBe(149_999);
  });

  it("guards against the double-scaling regression", () => {
    // A quantity of "1" is stored as 1000. Passing 1 (already scaled) or
    // scaleQuantity(1) twice must not produce a 1,000,000x error.
    const once = multiplyQuantityPrice(scaleQuantity(1), 100_000);
    expect(once).toBe(100_000);
    expect(multiplyQuantityPrice(scaleQuantity(scaleQuantity(1)), 100_000)).not.toBe(once);
  });
});

describe("basis points", () => {
  it("converts percent to basis points", () => {
    expect(percentToBasisPoints(18)).toBe(1800);
    expect(percentToBasisPoints(0)).toBe(0);
    expect(percentToBasisPoints(100)).toBe(10_000);
  });

  it("applies basis points with half-up rounding", () => {
    expect(applyBasisPoints(10_000, 1800)).toBe(1800);
    expect(applyBasisPoints(10_001, 1800)).toBe(1800);
    // 0.5 paise rounds away from zero rather than truncating.
    expect(applyBasisPoints(1, 5000)).toBe(1);
  });
});

describe("allocateProportionally", () => {
  it("never loses or invents paise", () => {
    const parts = allocateProportionally(100, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("distributes the remainder deterministically", () => {
    // 100 paise over 3 equal weights cannot divide evenly, so 34/33/33.
    expect(allocateProportionally(100, [1, 1, 1])).toEqual([34, 33, 33]);
  });

  it("allocates nothing when every weight is zero", () => {
    // With no weights there is no basis to share, so nothing is invented.
    expect(allocateProportionally(10, [0, 0])).toEqual([0, 0]);
  });

  it("returns zeroes for a zero total", () => {
    expect(allocateProportionally(0, [5, 5])).toEqual([0, 0]);
  });
});

describe("roundHalfUp", () => {
  it("rounds .5 away from zero, symmetrically", () => {
    expect(roundHalfUp(0.5)).toBe(1);
    expect(roundHalfUp(1.5)).toBe(2);
    expect(roundHalfUp(2.5)).toBe(3);
    // Unlike Math.round(-0.5) === -0, this is -1: symmetric about zero.
    expect(roundHalfUp(-0.5)).toBe(-1);
    expect(roundHalfUp(-1.5)).toBe(-2);
  });

  it("treats non-finite input as zero rather than propagating NaN", () => {
    expect(roundHalfUp(NaN)).toBe(0);
    expect(roundHalfUp(Infinity)).toBe(0);
  });
});

describe("clamp", () => {
  it("bounds a value to the given range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});
