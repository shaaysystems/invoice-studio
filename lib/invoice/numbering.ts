import type { NumberingProfile } from "@/types/business";
import type { InvoiceListRow } from "@/types/invoice";

export interface NumberingConfig {
  prefix: string;
  nextSequence: number;
  padding: number;
}

/** Indian financial year label, e.g. April 2026 → "2026-27". */
export function financialYear(date = new Date()): string {
  const year = date.getFullYear();
  const startMonth = date.getMonth() + 1; // 1-12
  const startYear = startMonth >= 4 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export function sanitizePrefix(prefix: string, fallback = "INV"): string {
  const cleaned = (prefix || "").trim().replace(/[^\w\-/]/g, "").replace(/-+$/, "");
  return cleaned || fallback;
}

/**
 * `generateInvoiceNumber({ prefix: "INV-2026", nextSequence: 42, padding: 3 })`
 *   → "INV-2026-042"
 */
export function generateInvoiceNumber(config: NumberingConfig): string {
  const prefix = sanitizePrefix(config.prefix);
  const padding = Math.min(8, Math.max(1, Math.trunc(config.padding || 3)));
  const serial = String(Math.max(1, Math.trunc(config.nextSequence || 1))).padStart(padding, "0");
  return `${prefix}-${serial}`;
}

export function defaultPrefix(base = "INV", date = new Date()): string {
  return `${base}-${date.getFullYear()}`;
}

export function defaultNumberingProfile(): NumberingProfile {
  return {
    prefix: defaultPrefix(),
    nextSequence: 1,
    padding: 3,
    resetYearly: true,
    financialYear: financialYear(),
  };
}

/**
 * Resets the sequence to 1 when the financial year rolls over.
 * Returns the profile unchanged when yearly reset is off.
 */
export function rollNumberingIfYearChanged(
  profile: NumberingProfile,
  date = new Date(),
): { numbering: NumberingProfile; reset: boolean } {
  if (!profile.resetYearly) return { numbering: profile, reset: false };
  const current = financialYear(date);
  if (profile.financialYear === current) return { numbering: profile, reset: false };
  return { numbering: { ...profile, nextSequence: 1, financialYear: current }, reset: true };
}

export function numberingConfigFromProfile(profile: NumberingProfile): NumberingConfig {
  return {
    prefix: sanitizePrefix(profile.prefix),
    nextSequence: Math.max(1, Math.trunc(profile.nextSequence || 1)),
    padding: Math.min(8, Math.max(1, Math.trunc(profile.padding || 3))),
  };
}

/** Returns true when the number is already used by a *different* invoice. */
export function isDuplicateInvoiceNumber(
  candidate: string,
  existing: { id: string; number: string }[],
  currentId: string,
): boolean {
  const target = candidate.trim().toLowerCase();
  if (!target) return false;
  return existing.some((row) => row.id !== currentId && row.number.trim().toLowerCase() === target);
}

/** Picks the next free number, skipping collisions inside the same business. */
export function nextAvailableInvoiceNumber(
  config: NumberingConfig,
  existing: { id: string; number: string }[],
  currentId = "",
): { number: string; nextSequence: number } {
  let nextSequence = Math.max(1, config.nextSequence);
  for (let attempt = 0; attempt < 5000; attempt += 1) {
    const candidate = generateInvoiceNumber({ ...config, nextSequence });
    if (!isDuplicateInvoiceNumber(candidate, existing, currentId)) {
      return { number: candidate, nextSequence };
    }
    nextSequence += 1;
  }
  return { number: generateInvoiceNumber({ ...config, nextSequence }), nextSequence };
}

export type { InvoiceListRow };
