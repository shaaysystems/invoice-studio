export const MINOR_PER_UNIT = 100;
export const QTY_SCALE = 1000;

/** Half-up rounding, symmetric about zero (unlike Math.round for negatives). */
export function roundHalfUp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

export function rupeesToMinor(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const normalized = String(value).trim().replace(/,/g, "").replace(/^₹\s*/, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  // Route through a fixed-precision string to defuse binary float artefacts.
  return roundHalfUp(Number(parsed.toFixed(6)) * MINOR_PER_UNIT);
}

export function minorToRupees(minor: number): number {
  return minor / MINOR_PER_UNIT;
}

/** Rupee value suitable for a controlled numeric input (no trailing .00 noise). */
export function minorToInputValue(minor: number): string {
  if (!minor) return "";
  const rupees = minor / MINOR_PER_UNIT;
  return Number.isInteger(rupees) ? String(rupees) : rupees.toFixed(2);
}

export function scaleQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 0;
  return roundHalfUp(Number(quantity.toFixed(6)) * QTY_SCALE);
}

/** Inverse of `scaleQuantity` — for display and text inputs only. */
export function unscaleQuantity(qtyMilli: number): number {
  if (!Number.isFinite(qtyMilli)) return 0;
  return roundHalfUp(qtyMilli) / QTY_SCALE;
}

/** quantity × unit price, entirely in integer space. */
export function multiplyQuantityPrice(qtyMilli: number, unitPriceMinor: number): number {
  return roundHalfUp((qtyMilli * unitPriceMinor) / QTY_SCALE);
}

export function percentToBasisPoints(percent: number): number {
  return roundHalfUp(Number((percent || 0).toFixed(4)) * 100);
}

/** base × rate, where rate is in basis points (1800 bp = 18%). */
export function applyBasisPoints(baseMinor: number, rateBp: number): number {
  return roundHalfUp((baseMinor * rateBp) / 10_000);
}

/**
 * Distributes `totalMinor` across `weights` using the largest-remainder method
 * so the parts always sum to exactly `totalMinor` — no lost or invented paise.
 */
export function allocateProportionally(totalMinor: number, weights: number[]): number[] {
  const count = weights.length;
  if (count === 0) return [];
  const weightSum = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
  if (weightSum <= 0 || totalMinor === 0) return new Array<number>(count).fill(0);

  const floors: number[] = [];
  const remainders: { index: number; remainder: number }[] = [];
  let allocated = 0;

  for (let i = 0; i < count; i += 1) {
    const exact = (totalMinor * Math.max(0, weights[i] as number)) / weightSum;
    const floor = Math.floor(exact);
    floors.push(floor);
    allocated += floor;
    remainders.push({ index: i, remainder: exact - floor });
  }

  let leftover = totalMinor - allocated;
  remainders.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let i = 0; i < remainders.length && leftover > 0; i += 1) {
    floors[remainders[i]!.index] = (floors[remainders[i]!.index] as number) + 1;
    leftover -= 1;
  }
  return floors;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
