import type { InvoiceBrand } from "@/types/invoice";

export interface BrandPalette {
  id: string;
  name: string;
  colors: Pick<InvoiceBrand, "primary" | "accent" | "surface" | "text">;
}

export const DEFAULT_PALETTE: BrandPalette = {
  id: "slate",
  name: "Slate",
  colors: { primary: "#0f172a", accent: "#f97316", surface: "#ffffff", text: "#0f172a" },
};

export const SYSTEM_PALETTES: BrandPalette[] = [
  DEFAULT_PALETTE,
  {
    id: "emerald",
    name: "Emerald",
    colors: { primary: "#064e3b", accent: "#059669", surface: "#ffffff", text: "#0f172a" },
  },
  {
    id: "indigo",
    name: "Indigo",
    colors: { primary: "#1e1b4b", accent: "#4f46e5", surface: "#ffffff", text: "#1f2937" },
  },
  {
    id: "crimson",
    name: "Crimson",
    colors: { primary: "#4c0519", accent: "#e11d48", surface: "#fffbfb", text: "#1f2937" },
  },
  {
    id: "amber",
    name: "Amber",
    colors: { primary: "#451a03", accent: "#d97706", surface: "#fffdf7", text: "#292524" },
  },
  {
    id: "violet",
    name: "Violet",
    colors: { primary: "#2e1065", accent: "#7c3aed", surface: "#ffffff", text: "#1f2937" },
  },
];

export function paletteById(id: string): BrandPalette {
  return SYSTEM_PALETTES.find((palette) => palette.id === id) ?? DEFAULT_PALETTE;
}

export function defaultBrand(): InvoiceBrand {
  return {
    ...DEFAULT_PALETTE.colors,
    paletteId: DEFAULT_PALETTE.id,
    accentBarEnabled: true,
    showLogo: true,
  };
}
