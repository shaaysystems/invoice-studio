import { describe, expect, it } from "vitest";
import { buildExportFilename, sanitizeFilename } from "@/lib/export/filename";

describe("export filenames", () => {
  it("strips unsafe characters", () => {
    expect(sanitizeFilename("INV/2026\\001:*?")).toBe("INV-2026-001");
    expect(sanitizeFilename("  spaced  out  ")).toBe("spaced-out");
  });

  it("builds a readable filename", () => {
    const name = buildExportFilename({ number: "INV-2026-001", clientName: "Acme Pvt Ltd" }, "pdf");
    expect(name).toBe("INV-2026-001-Acme-Pvt-Ltd.pdf");
  });

  it("falls back when fields are empty", () => {
    expect(buildExportFilename({ number: "", clientName: "" }, "jpg")).toMatch(/^invoice.*\.jpg$/);
  });

  it("caps length", () => {
    const name = buildExportFilename({ number: "X".repeat(200), clientName: "Y".repeat(200) }, "pdf");
    expect(name.length).toBeLessThanOrEqual(120);
  });
});
