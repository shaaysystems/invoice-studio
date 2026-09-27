// app/dashboard/brand/BrandClient.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchBrandProfileAction,
  saveBrandProfileAction,
} from "@/lib/actions/brand";
import { DEFAULT_PALETTE, SYSTEM_PALETTES, defaultBrand } from "@/lib/brand/presets";
import { analyzePalette, contrastRatio } from "@/lib/brand/contrast";
import { buildInvoiceTokens } from "@/lib/brand/tokens";
import { localStore } from "@/lib/storage/local";
import { normalizeHexColor, validateHexColor } from "@/lib/validation/color";
import { brandSchema } from "@/lib/validation/invoice-schema";
import { AppShell } from "@/components/dashboard/AppShell";
import { Alert, Button, Field, Input, SectionCard, Skeleton, Switch } from "@/components/ui";
import type { InvoiceBrand } from "@/types/invoice";
import type { BrandProfile } from "@/types/brand";

type ColorRole = "primary" | "accent" | "surface" | "text";
type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const ROLES: { key: ColorRole; label: string; usage: string }[] = [
  { key: "primary", label: "Primary", usage: "Headings, the invoice title and key labels" },
  { key: "accent", label: "Accent", usage: "The total block, rules and brand marks" },
  { key: "surface", label: "Surface", usage: "The invoice paper itself" },
  { key: "text", label: "Text", usage: "Body copy and table contents" },
];


export function BrandClient({
  authenticated,
  businessProfileId,
}: {
  authenticated: boolean;
  businessProfileId: string | null;
}) {
  const [brand, setBrand] = useState<InvoiceBrand>(() => defaultBrand());
  const [profileId, setProfileId] = useState<string>(() => crypto.randomUUID());
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = localStore.getBrand();
      if (local) {
        setBrand(local);
        setLoading(false);
        return;
      }
      if (authenticated && businessProfileId) {
        const result = await fetchBrandProfileAction(businessProfileId);
        if (cancelled) return;
        if (result.ok && result.data) {
          const { id, brand } = { id: result.data.id, brand: result.data };
          setBrand(brand);
          setProfileId(id);
          setLoading(false);
          return;
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, businessProfileId]);

  const patch = useCallback((fields: Partial<InvoiceBrand>) => {
    setBrand((current) => ({ ...current, ...fields }));
    setSaveState("dirty");
  }, []);

  const setColor = useCallback(
    (key: ColorRole, raw: string) => {
      const normalized = normalizeHexColor(raw);
      // Keep the raw text so typing is never fought; only commit valid HEX.
      if (normalized) patch({ [key]: normalized } as Partial<InvoiceBrand>);
    },
    [patch],
  );

  const warnings = useMemo(() => analyzePalette(brand), [brand]);
  const tokens = useMemo(() => buildInvoiceTokens(brand), [brand]);
  const parsed = useMemo(() => brandSchema.safeParse(brand).success, [brand]);

  async function handleSave() {
    setSaveState("saving");
    setMessage(null);

    const profile: BrandProfile = {
      ...brand,
      id: profileId,
      businessProfileId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (authenticated) {
      const result = await saveBrandProfileAction(profile);
      if (!result.ok) {
        setSaveState("error");
        setMessage(result.error ?? "We couldn't save your brand settings.");
        return;
      }
      localStore.saveBrand(brand);
      setSaveState("saved");
      setMessage("Brand saved. New invoices will use these colours.");
      return;
    }

    const stored = localStore.saveBrand(brand);
    setSaveState(stored ? "saved" : "error");
    setMessage(
      stored
        ? "Saved in this browser. Sign in to sync your brand across devices."
        : "This browser's storage is full, so the brand could not be saved.",
    );
  }

  if (loading) {
    return (
      <AppShell authenticated={authenticated}>
        <div className="space-y-3 p-6">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-72 w-full" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell authenticated={authenticated}>
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-shell-900">Brand</h1>
            <p className="mt-1 text-sm text-shell-500">
              New invoices pick these up automatically. Invoices already issued keep the colours they were sent with.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span aria-live="polite" className="text-[11px] text-shell-500">
              {saveState === "dirty"
                ? "Unsaved changes"
                : saveState === "saving"
                  ? "Saving…"
                  : saveState === "error"
                    ? "Couldn't save"
                    : "All changes saved"}
            </span>
            <Button type="button" variant="primary" onClick={() => void handleSave()}>
              Save brand
            </Button>
          </div>
        </div>

        {message ? <Alert tone={saveState === "error" ? "error" : "info"}>{message}</Alert> : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <SectionCard
            title="Brand colours"
            description="Every invoice surface is built from these four colours."
            action={
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => patch({ ...DEFAULT_PALETTE.colors, paletteId: DEFAULT_PALETTE.id })}
              >
                Reset
              </Button>
            }
          >
            <div>
              <p className="mb-2 text-xs font-medium text-shell-700">Presets</p>
              <div className="flex flex-wrap gap-2">
                {SYSTEM_PALETTES.map((palette) => (
                  <button
                    key={palette.id}
                    type="button"
                    aria-pressed={brand.paletteId === palette.id}
                    onClick={() => patch({ ...palette.colors, paletteId: palette.id })}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                      brand.paletteId === palette.id
                        ? "border-shell-900 bg-shell-50 text-shell-900"
                        : "border-shell-200 bg-white text-shell-700 hover:border-shell-900"
                    }`}
                  >
                    <span className="flex overflow-hidden rounded-[3px]">
                      {Object.values(palette.colors).map((color) => (
                        <span key={color} style={{ backgroundColor: color }} className="size-3.5" />
                      ))}
                    </span>
                    {palette.name}
                  </button>
                ))}
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
                    error={invalid ? "Enter a valid HEX colour, for example #059669." : undefined}
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

            <div className="space-y-3 rounded-lg border border-shell-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium text-shell-700">Accent bar</p>
                  <p className="text-[11px] text-shell-500">A coloured rule under the header.</p>
                </div>
                <Switch
                  checked={brand.accentBarEnabled}
                  onChange={(accentBarEnabled) => patch({ accentBarEnabled })}
                  label="Accent bar"
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium text-shell-700">Show logo</p>
                  <p className="text-[11px] text-shell-500">Uses the logo from your business profile.</p>
                </div>
                <Switch
                  checked={brand.showLogo}
                  onChange={(showLogo) => patch({ showLogo })}
                  label="Show logo"
                />
              </div>
            </div>

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
                Contrast looks good. Body text sits at {contrastRatio(brand.text, brand.surface)}:1 against the
                invoice surface.
              </Alert>
            )}
          </SectionCard>

          <div className="space-y-4">
            <SectionCard title="Preview" description="How the totals block will read.">
              <div
                className="rounded-md px-3 py-2.5"
                style={{ backgroundColor: tokens.totalBg, color: tokens.totalInk }}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span>Taxable</span>
                  <span className="font-mono">₹42,000.00</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span>CGST 9%</span>
                  <span className="font-mono">₹3,780.00</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span>SGST 9%</span>
                  <span className="font-mono">₹3,780.00</span>
                </div>
                <div
                  className="mt-1.5 flex items-center justify-between border-t pt-1.5 text-sm font-semibold"
                  style={{ borderColor: tokens.totalInk, color: tokens.totalInk }}
                >
                  <span>Total due</span>
                  <span className="font-mono">₹49,560.00</span>
                </div>
              </div>

              <div
                className="mt-3 rounded-md border p-3"
                style={{ backgroundColor: brand.surface, borderColor: tokens.rule, color: brand.text }}
              >
                {brand.accentBarEnabled ? (
                  <div
                    className="mb-2.5 h-1 w-16 rounded-full"
                    style={{ backgroundColor: brand.accent }}
                    aria-hidden
                  />
                ) : null}
                <p className="text-sm font-semibold" style={{ color: brand.primary }}>
                  INVOICE
                </p>
                <p className="mt-1 text-[11px] opacity-70">Billed to Acme Industries</p>
                <p className="mt-2 text-[11px]">Design retainer — April</p>
              </div>
            </SectionCard>

            <SectionCard title="Invoice header" description="Type colour for titles and totals.">
              <div className="space-y-1.5">
                {(
                  [
                    ["primary", "Primary"],
                    ["accent", "Accent"],
                    ["surface", "Surface"],
                    ["text", "Text"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between text-[11px]">
                    <span className="text-shell-500">{label}</span>
                    <span className="flex items-center gap-1.5 font-mono text-shell-700">
                      <span
                        className="size-3.5 rounded-[3px] border border-shell-200"
                        style={{ backgroundColor: brand[key] }}
                        aria-hidden
                      />
                      {brand[key].toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </SectionCard>

            {!parsed ? (
              <Alert tone="warning">
                One or more colours aren&rsquo;t valid HEX yet, so saving is disabled until they&rsquo;re fixed.
              </Alert>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
