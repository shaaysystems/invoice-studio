"use client";

import { buildInvoiceTokens } from "@/lib/brand/tokens";
import { analyzePalette, contrastRatio, readableForeground } from "@/lib/brand/contrast";
import { DEFAULT_PALETTE, SYSTEM_PALETTES } from "@/lib/brand/presets";
import { useInvoiceStore } from "@/lib/store/invoice-store";
import { normalizeHexColor, validateHexColor } from "@/lib/validation/color";
import { Alert, Button, Field, Input, SectionCard, Switch, Tooltip } from "@/components/ui";
import type { InvoiceBrand } from "@/types/invoice";

type ColorRole = "primary" | "accent" | "surface" | "text";

const ROLES: { key: ColorRole; label: string; usage: string }[] = [
  { key: "primary", label: "Primary", usage: "Headings, invoice title and key labels" },
  { key: "accent", label: "Accent", usage: "Total block, highlights and brand marks" },
  { key: "surface", label: "Surface", usage: "The invoice paper itself" },
  { key: "text", label: "Text", usage: "Body copy and table contents" },
];

export function BrandColorPicker() {
  const brand = useInvoiceStore((s) => s.invoice.brand);
  const patchBrand = useInvoiceStore((s) => s.patchBrand);
  const warnings = analyzePalette(brand);
  const tokens = buildInvoiceTokens(brand);

  const setColor = (key: ColorRole, raw: string) => {
    const normalized = normalizeHexColor(raw);
    // Keep the raw text so users can type freely; only commit valid HEX.
    if (normalized) patchBrand({ [key]: normalized } as Partial<InvoiceBrand>);
  };

  return (
    <SectionCard
      title="Brand colours"
      description="These colours are used throughout your invoice design."
      action={
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => patchBrand({ ...DEFAULT_PALETTE.colors, paletteId: DEFAULT_PALETTE.id })}
        >
          Reset
        </Button>
      }
    >
      <div>
        <p className="mb-2 text-xs font-medium text-shell-700">Presets</p>
        <div className="flex flex-wrap gap-2">
          {SYSTEM_PALETTES.map((palette) => {
            const active = brand.paletteId === palette.id;
            return (
              <button
                key={palette.id}
                type="button"
                aria-pressed={active}
                onClick={() => patchBrand({ ...palette.colors, paletteId: palette.id })}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                  active
                    ? "border-shell-900 bg-shell-50 text-shell-900"
                    : "border-shell-200 bg-white text-shell-700 hover:border-shell-900"
                }`}
              >
                <span className="flex overflow-hidden rounded-[3px]">
                  {/* Keyed by role, not colour: a palette often reuses one hex
                      for both `primary` and `text`. */}
                  {Object.entries(palette.colors).map(([role, color]) => (
                    <span key={role} style={{ backgroundColor: color }} className="size-3.5" />
                  ))}
                </span>
                {palette.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {ROLES.map((role) => {
          const value = brand[role.key];
          const invalid = !validateHexColor(value);
          return (
            <Field
              key={role.key}
              label={role.label}
              hint={role.usage}
              error={invalid ? "Enter a valid HEX colour, for example #F97316." : undefined}
            >
              {(p) => (
                <div className="flex items-center gap-2">
                  <label className="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-shell-200">
                    <span className="absolute inset-0" style={{ backgroundColor: value }} />
                    <input
                      type="color"
                      value={validateHexColor(value) ? value : "#000000"}
                      onChange={(e) => setColor(role.key, e.target.value)}
                      className="absolute inset-0 cursor-pointer opacity-0"
                      aria-label={`${role.label} colour picker`}
                    />
                  </label>
                  <Input
                    {...p}
                    value={value}
                    onChange={(e) => setColor(role.key, e.target.value)}
                    onBlur={(e) => setColor(role.key, e.target.value)}
                    className="font-mono uppercase"
                    maxLength={7}
                  />
                </div>
              )}
            </Field>
          );
        })}
      </div>

      {/* Contrast warnings surface problems without overriding user choices. */}
      {warnings.length > 0 ? (
        <div className="space-y-2">
          {warnings.map((warning) => (
            <Alert
              key={warning.id}
              tone={warning.severity === "critical" ? "error" : "warning"}
              title={warning.severity === "critical" ? "Readability problem" : "Readability note"}
            >
              {warning.message}
              {warning.suggestion ? <span className="mt-1 block font-medium">{warning.suggestion}</span> : null}
            </Alert>
          ))}
        </div>
      ) : (
        <Alert tone="success">
          Contrast looks good. Body text sits at {contrastRatio(brand.text, brand.surface)}:1 against the invoice
          surface.
        </Alert>
      )}

      <div className="rounded-lg border border-shell-200 p-3">
        <p className="mb-2 text-[11px] font-medium text-shell-700">Total block preview</p>
        <div
          className="rounded-md px-3 py-2.5"
          style={{ backgroundColor: tokens.totalBg, color: tokens.totalInk }}
        >
          <p className="text-[9px] font-semibold uppercase tracking-widest opacity-80">Total due</p>
          <p className="text-lg font-bold tabular" style={{ color: tokens.totalInk }}>
            ₹47,200.00
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg bg-shell-50 px-3 py-2.5">
          <span className="text-xs font-medium text-shell-700">Show the logo</span>
          <Switch
            checked={brand.showLogo}
            onChange={(showLogo) => patchBrand({ showLogo })}
            label="Show the logo"
          />
        </div>

        <div className="flex items-center justify-between rounded-lg bg-shell-50 px-3 py-2.5">
          <span className="flex items-center gap-2 text-xs font-medium text-shell-700">
            Accent bar
            <Tooltip text="Draws a thin accent rule under the header. Never interferes with print readability.">
              <span
                tabIndex={0}
                role="img"
                aria-label="About the accent bar"
                className="grid size-3.5 cursor-help place-items-center rounded-full border border-shell-300 text-[8px] text-shell-500"
              >
                i
              </span>
            </Tooltip>
          </span>
          <Switch
            checked={brand.accentBarEnabled}
            onChange={(accentBarEnabled) => patchBrand({ accentBarEnabled })}
            label="Accent bar"
          />
        </div>

        <p className="text-[11px] text-shell-500">
          Total block ink resolves to {readableForeground(tokens.totalBg)} for legibility.
        </p>
      </div>
    </SectionCard>
  );
}
