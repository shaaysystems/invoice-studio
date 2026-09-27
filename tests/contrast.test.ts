import { describe, expect, it } from "vitest";
import {
  analyzePalette,
  contrastRatio,
  hexToRgb,
  mix,
  readableForeground,
  relativeLuminance,
  withAlphaOver,
} from "@/lib/brand/contrast";
import { DEFAULT_PALETTE, SYSTEM_PALETTES, defaultBrand, paletteById } from "@/lib/brand/presets";

describe("hexToRgb", () => {
  it("parses a 6-digit hex", () => {
    expect(hexToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("accepts shorthand hex", () => {
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("is case-insensitive and tolerates a missing hash", () => {
    expect(hexToRgb("FFFFFF")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("returns black for unparseable input rather than NaN channels", () => {
    expect(hexToRgb("not-a-colour")).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe("contrastRatio / relativeLuminance", () => {
  it("gives the maximum ratio for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("gives 1:1 for identical colours", () => {
    expect(contrastRatio("#123456", "#123456")).toBeCloseTo(1, 5);
  });

  it("is symmetric in its arguments", () => {
    expect(contrastRatio("#059669", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#059669"),
      6,
    );
  });

  it("puts black at zero luminance and white at one", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 6);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 6);
  });
});

describe("readableForeground", () => {
  it("picks dark ink on a light background", () => {
    expect(readableForeground("#ffffff").toLowerCase()).not.toBe("#ffffff");
  });

  it("picks light ink on a dark background", () => {
    expect(readableForeground("#000000").toLowerCase()).toBe("#ffffff");
  });

  it("honours overrides on the side that wins the contrast comparison", () => {
    // A dark background: light ink wins, so the light override is used.
    expect(readableForeground("#000000", { light: "#ff0000" })).toBe("#ff0000");
    // A light background: dark ink wins, so the dark override is used.
    expect(readableForeground("#ffffff", { dark: "#123456" })).toBe("#123456");
  });
});

describe("mix / withAlphaOver", () => {
  it("mixes toward the second colour by weight", () => {
    expect(mix("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mix("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("composites a translucent colour over a background", () => {
    // Fully opaque input returns the colour itself.
    expect(withAlphaOver("#ff0000", "#ffffff", 1)).toBe("#ff0000");
    // Fully transparent shows the background.
    expect(withAlphaOver("#ff0000", "#0000ff", 0)).toBe("#0000ff");
  });
});

describe("analyzePalette", () => {
  it("accepts a readable palette", () => {
    const warnings = analyzePalette(DEFAULT_PALETTE.colors);
    expect(warnings.filter((w) => w.severity === "critical")).toHaveLength(0);
  });

  it("flags body text that is unreadable on the surface", () => {
    const warnings = analyzePalette({
      primary: "#000000",
      accent: "#000000",
      surface: "#ffffff",
      text: "#fdfdfd",
    });
    expect(warnings.some((w) => w.severity === "critical")).toBe(true);
  });

  it("returns every warning with a usable message", () => {
    const warnings = analyzePalette({
      primary: "#ffff00",
      accent: "#ffff00",
      surface: "#fffffe",
      text: "#fffffd",
    });
    for (const warning of warnings) {
      expect(warning.message.length).toBeGreaterThan(0);
      expect(["critical", "warning"]).toContain(warning.severity);
    }
  });
});

describe("presets", () => {
  it("includes the Emerald palette used by the editor", () => {
    expect(SYSTEM_PALETTES.some((p) => p.name === "Emerald")).toBe(true);
  });

  it("gives every palette four valid colours", () => {
    for (const palette of SYSTEM_PALETTES) {
      for (const color of Object.values(palette.colors)) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("looks a palette up by id", () => {
    expect(paletteById("emerald").id).toBe("emerald");
  });

  it("falls back to the default for an unknown id", () => {
    expect(paletteById("nope").id).toBe(DEFAULT_PALETTE.id);
  });

  it("builds a default brand from the default palette", () => {
    const brand = defaultBrand();
    expect(brand.primary).toBe(DEFAULT_PALETTE.colors.primary);
    expect(brand.paletteId).toBe(DEFAULT_PALETTE.id);
    expect(typeof brand.accentBarEnabled).toBe("boolean");
    expect(typeof brand.showLogo).toBe("boolean");
  });
});
