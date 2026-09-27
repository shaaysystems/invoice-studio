import { mix, readableForeground, withAlphaOver } from "./contrast";
import type { InvoiceBrand } from "@/types/invoice";

/**
 * Semantic design tokens. Components never reference `brand.accent`
 * directly — they consume roles, so palettes can be remapped per invoice.
 */
export interface InvoiceTokens {
  pageBg: string;
  ink: string;
  inkStrong: string;
  inkMuted: string;
  inkSubtle: string;
  rule: string;
  ruleStrong: string;
  surface: string;
  surfaceInk: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  tableHeadBg: string;
  tableHeadInk: string;
  rowAltBg: string;
  totalBg: string;
  totalInk: string;
  totalAccent: string;
  titleColor: string;
  numberPillBg: string;
  numberPillInk: string;
}

export function buildInvoiceTokens(brand: InvoiceBrand): InvoiceTokens {
  const { primary, accent, surface, text } = brand;

  // Guarantee legibility even when the user's own colours conflict.
  const safeText = readableForeground(surface, { dark: text, light: "#ffffff" });
  const ink = safeText === "#ffffff" ? "#ffffff" : text;

  const accentInk = readableForeground(accent);
  const surfaceInk = readableForeground(surface, { dark: primary, light: "#ffffff" });

  return {
    pageBg: surface,
    ink,
    inkStrong: readableForeground(surface, { dark: primary, light: "#ffffff" }),
    inkMuted: withAlphaOver(ink, surface, 0.66),
    inkSubtle: withAlphaOver(ink, surface, 0.46),
    rule: withAlphaOver(ink, surface, 0.14),
    ruleStrong: withAlphaOver(ink, surface, 0.3),
    surface,
    surfaceInk,
    accent,
    accentInk,
    accentSoft: withAlphaOver(accent, surface, 0.12),
    tableHeadBg: surface,
    tableHeadInk: withAlphaOver(ink, surface, 0.7),
    rowAltBg: withAlphaOver(ink, surface, 0.035),
    totalBg: accent,
    totalInk: accentInk,
    totalAccent: accentInk,
    titleColor: readableForeground(surface, { dark: primary, light: "#ffffff" }),
    numberPillBg: mix(surface, accent, 0.14),
    numberPillInk: ink,
  };
}
