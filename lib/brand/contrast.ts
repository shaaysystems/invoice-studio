import { normalizeHexColor } from "@/lib/validation/color";

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb {
  const normalized = normalizeHexColor(hex) ?? "#000000";
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

const channel = (value: number): number => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

/** Readable foreground for a given surface. Never mutates the user's colours. */
export function readableForeground(background: string, options: { light?: string; dark?: string } = {}): string {
  const light = options.light ?? "#ffffff";
  const dark = options.dark ?? "#0b0b0c";
  return contrastRatio(background, dark) >= contrastRatio(background, light) ? dark : light;
}

export function mix(a: string, b: string, weight: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const w = Math.min(1, Math.max(0, weight));
  const to = (x: number, y: number) => Math.round(x + (y - x) * w).toString(16).padStart(2, "0");
  return `#${to(ca.r, cb.r)}${to(ca.g, cb.g)}${to(ca.b, cb.b)}`;
}

export function withAlphaOver(color: string, background: string, alpha: number): string {
  return mix(background, color, alpha);
}

export interface ContrastWarning {
  id: string;
  severity: "warning" | "critical";
  message: string;
  suggestion?: string;
  ratio: number;
}

const MIN_BODY_RATIO = 4.5;
const MIN_LARGE_RATIO = 3;

/**
 * Surfaces readability problems without silently overriding the palette.
 * Critical warnings target information that must always be legible.
 */
export function analyzePalette(colors: {
  primary: string;
  accent: string;
  surface: string;
  text: string;
}): ContrastWarning[] {
  const warnings: ContrastWarning[] = [];

  const textOnSurface = contrastRatio(colors.text, colors.surface);
  if (textOnSurface < MIN_BODY_RATIO) {
    warnings.push({
      id: "text-on-surface",
      severity: "critical",
      ratio: textOnSurface,
      message: `Body text on the invoice surface has a contrast ratio of ${textOnSurface}:1, below the 4.5:1 readability threshold.`,
      suggestion: `Darken the text colour, or use ${readableForeground(colors.surface)} for text.`,
    });
  }

  const primaryOnSurface = contrastRatio(colors.primary, colors.surface);
  if (primaryOnSurface < MIN_BODY_RATIO) {
    warnings.push({
      id: "primary-on-surface",
      severity: "critical",
      ratio: primaryOnSurface,
      message: `Headings in the primary colour have a contrast ratio of ${primaryOnSurface}:1 against the invoice surface, below 4.5:1.`,
      suggestion: "Darken the primary colour until headings stay legible in print.",
    });
  }

  const accentOnSurface = contrastRatio(colors.accent, colors.surface);
  if (accentOnSurface < MIN_LARGE_RATIO) {
    warnings.push({
      id: "accent-on-surface",
      severity: "warning",
      ratio: accentOnSurface,
      message: `The accent colour is very close to the surface (${accentOnSurface}:1). Accent bars and highlights may disappear when printed.`,
    });
  }

  return warnings;
}
