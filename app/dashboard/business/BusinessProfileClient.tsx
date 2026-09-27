// app/dashboard/business/BusinessProfileClient.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchBusinessProfileAction,
  saveBusinessProfileAction,
} from "@/lib/actions/business";
import { createDefaultBusinessProfile } from "@/lib/invoice/defaults";
import { financialYear, sanitizePrefix } from "@/lib/invoice/numbering";
import { localStore } from "@/lib/storage/local";
import { validateGSTIN, validateIFSC, validatePAN, validateUPI } from "@/lib/validation/gstin";
import { businessProfileSchema } from "@/lib/validation/invoice-schema";
import { AppShell } from "@/components/dashboard/AppShell";
import { ImageUploader } from "@/components/editor/ImageUploader";
import {
  Alert,
  Button,
  Disclosure,
  Field,
  Input,
  SectionCard,
  Skeleton,
  Switch,
  Textarea,
} from "@/components/ui";
import type { BusinessProfile } from "@/types/business";
import type { Address } from "@/types/invoice";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export function BusinessProfileClient({ authenticated }: { authenticated: boolean }) {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (authenticated) {
        const result = await fetchBusinessProfileAction();
        if (cancelled) return;
        if (result.ok) {
          setProfile(result.data ?? createDefaultBusinessProfile("cloud"));
          return;
        }
        setMessage(result.error ?? "We couldn't load your profile. You can still edit and save it.");
      }
      setProfile(localStore.getBusinessProfile() ?? createDefaultBusinessProfile());
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  const patch = useCallback((updater: (current: BusinessProfile) => BusinessProfile) => {
    setProfile((current) => (current ? { ...updater(current), updatedAt: new Date().toISOString() } : current));
    setSaveState("dirty");
  }, []);

  const patchParty = useCallback(
    (fields: Partial<BusinessProfile["party"]>) => patch((p) => ({ ...p, party: { ...p.party, ...fields } })),
    [patch],
  );
  const patchAddress = useCallback(
    (fields: Partial<Address>) => patch((p) => ({ ...p, party: { ...p.party, address: { ...p.party.address, ...fields } } })),
    [patch],
  );
  const patchSocials = useCallback(
    (fields: Partial<BusinessProfile["party"]["socials"]>) =>
      patch((p) => ({ ...p, party: { ...p.party, socials: { ...p.party.socials, ...fields } } })),
    [patch],
  );
  const patchBank = useCallback(
    (fields: Partial<BusinessProfile["payment"]["bank"]>) =>
      patch((p) => ({ ...p, payment: { ...p.payment, bank: { ...p.payment.bank, ...fields } } })),
    [patch],
  );
  const patchPayment = useCallback(
    (fields: Partial<BusinessProfile["payment"]>) =>
      patch((p) => ({ ...p, payment: { ...p.payment, ...fields } })),
    [patch],
  );
  const patchSignature = useCallback(
    (fields: Partial<BusinessProfile["signature"]>) =>
      patch((p) => ({ ...p, signature: { ...p.signature, ...fields } })),
    [patch],
  );
  const patchNumbering = useCallback(
    (fields: Partial<BusinessProfile["numbering"]>) =>
      patch((p) => ({ ...p, numbering: { ...p.numbering, ...fields } })),
    [patch],
  );

  const issues = useMemo(() => {
    if (!profile) return [];
    const result = businessProfileSchema.safeParse(profile);
    return result.success ? [] : result.error.issues;
  }, [profile]);

  async function handleSave() {
    if (!profile) return;
    setSaveState("saving");

    if (authenticated) {
      const result = await saveBusinessProfileAction(profile);
      if (!result.ok) {
        setSaveState("error");
        setMessage(result.error ?? "We couldn't save your profile.");
        return;
      }
      setSaveState("saved");
      setMessage("Profile saved to your account.");
      return;
    }

    const stored = localStore.saveBusinessProfile(profile);
    setSaveState(stored ? "saved" : "error");
    setMessage(
      stored
        ? "Saved in this browser. Sign in to sync across devices."
        : "This browser's storage is full, so the profile could not be saved.",
    );
  }

  if (!profile) {
    return (
      <AppShell authenticated={authenticated}>
        <div className="space-y-3 p-6">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppShell>
    );
  }

  const { party, payment, signature, numbering } = profile;
  const gstinError = party.gstin && !validateGSTIN(party.gstin) ? "Enter a valid GSTIN or leave it empty." : undefined;
  const panError = party.pan && !validatePAN(party.pan) ? "Enter a valid PAN such as ABCDE1234F, or leave it empty." : undefined;
  const ifscError = payment.bank.ifsc && !validateIFSC(payment.bank.ifsc) ? "Enter a valid IFSC such as HDFC0001234." : undefined;
  const upiError = payment.upiId && !validateUPI(payment.upiId) ? "Enter a valid UPI ID such as name@bank." : undefined;

  return (
    <AppShell authenticated={authenticated}>
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-shell-900">Business profile</h1>
            <p className="mt-1 text-sm text-shell-500">
              Saved once, then applied to every new invoice. Issued invoices keep their own copy.
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
              Save profile
            </Button>
          </div>
        </div>

        {message ? <Alert tone={saveState === "error" ? "error" : "info"}>{message}</Alert> : null}

        {issues.length > 0 ? (
          <Alert tone="warning" title="Before you save">
            <ul className="mt-1 space-y-0.5">
              {issues.slice(0, 6).map((issue) => (
                <li key={`${issue.path}-${issue.message}`}>
                  <strong>{issue.path || "Profile"}:</strong> {issue.message}
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}

        <SectionCard title="Your business" description="Appears as the sender on new invoices.">
          <Field label="Business name">
            {(p) => (
              <Input
                {...p}
                value={party.name}
                onChange={(e) => patchParty({ name: e.target.value })}
                placeholder="Northstar Creative Studio"
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" optional>
              {(p) => (
                <Input {...p} type="tel" value={party.phone} onChange={(e) => patchParty({ phone: e.target.value })} />
              )}
            </Field>
            <Field label="Email" optional>
              {(p) => (
                <Input
                  {...p}
                  type="email"
                  value={party.email}
                  onChange={(e) => patchParty({ email: e.target.value })}
                />
              )}
            </Field>
          </div>

          <ImageUploader
            label="Logo"
            hint="PNG, JPG, WEBP or SVG up to 2 MB. Your logo is never cropped or stretched."
            kind="logo"
            url={party.logoUrl}
            onChange={(logoUrl) => patchParty({ logoUrl })}
            authenticated={authenticated}
          />

          <Disclosure title="Address and legal details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Website" optional>
                {(p) => (
                  <Input
                    {...p}
                    value={party.socials.website}
                    onChange={(e) => patchSocials({ website: e.target.value })}
                    placeholder="studio.com"
                  />
                )}
              </Field>
              <Field label="Legal name" optional>
                {(p) => (
                  <Input
                    {...p}
                    value={party.legalName}
                    onChange={(e) => patchParty({ legalName: e.target.value })}
                  />
                )}
              </Field>
            </div>
            <Field label="Address line 1" optional>
              {(p) => (
                <Textarea
                  {...p}
                  rows={2}
                  value={party.address.line1}
                  onChange={(e) => patchAddress({ line1: e.target.value })}
                />
              )}
            </Field>
            <Field label="Address line 2" optional>
              {(p) => (
                <Input {...p} value={party.address.line2} onChange={(e) => patchAddress({ line2: e.target.value })} />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="City" optional>
                {(p) => <Input {...p} value={party.address.city} onChange={(e) => patchAddress({ city: e.target.value })} />}
              </Field>
              <Field label="State" optional>
                {(p) => <Input {...p} value={party.address.state} onChange={(e) => patchAddress({ state: e.target.value })} />}
              </Field>
              <Field label="State code" optional hint="Two digits, e.g. 32.">
                {(p) => (
                  <Input
                    {...p}
                    maxLength={2}
                    value={party.address.stateCode}
                    onChange={(e) => patchAddress({ stateCode: e.target.value })}
                  />
                )}
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="PIN code" optional>
                {(p) => (
                  <Input
                    {...p}
                    inputMode="numeric"
                    maxLength={6}
                    value={party.address.pincode}
                    onChange={(e) => patchAddress({ pincode: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Country" optional>
                {(p) => (
                  <Input
                    {...p}
                    value={party.address.country}
                    onChange={(e) => patchAddress({ country: e.target.value })}
                    placeholder="India"
                  />
                )}
              </Field>
            </div>
          </Disclosure>

          <Disclosure title="GST & tax identifiers" badge={party.gstin ? "GSTIN added" : undefined}>
            <Field label="GSTIN" optional error={gstinError}>
              {(p) => (
                <Input
                  {...p}
                  value={party.gstin}
                  onChange={(e) => patchParty({ gstin: e.target.value.toUpperCase().trim() })}
                  maxLength={15}
                  className="font-mono uppercase"
                  placeholder="32AAAAA0000A1Z5"
                />
              )}
            </Field>
            <Field label="PAN" optional error={panError}>
              {(p) => (
                <Input
                  {...p}
                  value={party.pan}
                  onChange={(e) => patchParty({ pan: e.target.value.toUpperCase() })}
                  maxLength={10}
                  className="font-mono uppercase"
                  placeholder="ABCDE1234F"
                />
              )}
            </Field>
            <Field label="Default GST rate (%)" hint="Applied to each new line item. Always editable per invoice.">
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={String(profile.defaultTaxRate)}
                  onChange={(e) => patch((p) => ({ ...p, defaultTaxRate: Number(e.target.value) || 0 }))}
                />
              )}
            </Field>
          </Disclosure>

          <Disclosure title="Social links">
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["instagram", "Instagram"],
                  ["linkedin", "LinkedIn"],
                  ["twitter", "X / Twitter"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label} optional>
                  {(p) => (
                    <Input {...p} value={party.socials[key]} onChange={(e) => patchSocials({ [key]: e.target.value })} />
                  )}
                </Field>
              ))}
            </div>
          </Disclosure>
        </SectionCard>

        <SectionCard title="Invoice numbering" description="Applied to every new invoice.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Prefix" hint="Letters, numbers, dashes, slashes or underscores.">
              {(p) => (
                <Input
                  {...p}
                  value={numbering.prefix}
                  onChange={(e) => patchNumbering({ prefix: e.target.value })}
                  placeholder="INV-2026"
                />
              )}
            </Field>
            <Field label="Next sequence" hint="Advanced automatically as you issue invoices.">
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  min="1"
                  step="1"
                  value={String(numbering.nextSequence)}
                  onChange={(e) => patchNumbering({ nextSequence: Math.max(1, Math.trunc(Number(e.target.value) || 1)) })}
                />
              )}
            </Field>
            <Field label="Digits" hint="Zero-padding on the serial number.">
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  min="1"
                  max="8"
                  step="1"
                  value={String(numbering.padding)}
                  onChange={(e) => patchNumbering({ padding: Math.min(8, Math.max(1, Math.trunc(Number(e.target.value) || 1))) })}
                />
              )}
            </Field>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-shell-50 px-3 py-2.5">
            <span className="text-xs font-medium text-shell-700">Reset the sequence each financial year</span>
            <Switch
              checked={numbering.resetYearly}
              onChange={(resetYearly) => patchNumbering({ resetYearly })}
              label="Reset the sequence each financial year"
            />
          </div>

          <p className="text-[11px] text-shell-500">
            Next number:{" "}
            <strong className="font-mono text-shell-700">
              {sanitizePrefix(numbering.prefix)}-
              {String(Math.max(1, numbering.nextSequence)).padStart(
                Math.min(8, Math.max(1, numbering.padding)),
                "0",
              )}
            </strong>{" "}
            · current financial year {numbering.financialYear || financialYear()}
          </p>
        </SectionCard>

        <SectionCard title="Default payment details" description="Prefilled on new invoices. Always optional.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Account name" optional>
              {(p) => (
                <Input {...p} value={payment.bank.accountName} onChange={(e) => patchBank({ accountName: e.target.value })} />
              )}
            </Field>
            <Field label="Bank name" optional>
              {(p) => (
                <Input {...p} value={payment.bank.bankName} onChange={(e) => patchBank({ bankName: e.target.value })} />
              )}
            </Field>
            <Field label="Account number" optional>
              {(p) => (
                <Input
                  {...p}
                  value={payment.bank.accountNumber}
                  onChange={(e) => patchBank({ accountNumber: e.target.value })}
                  className="font-mono"
                />
              )}
            </Field>
            <Field label="IFSC" optional error={ifscError}>
              {(p) => (
                <Input
                  {...p}
                  value={payment.bank.ifsc}
                  onChange={(e) => patchBank({ ifsc: e.target.value.toUpperCase() })}
                  maxLength={11}
                  className="font-mono uppercase"
                  placeholder="HDFC0001234"
                />
              )}
            </Field>
            <Field label="Branch" optional>
              {(p) => <Input {...p} value={payment.bank.branch} onChange={(e) => patchBank({ branch: e.target.value })} />}
            </Field>
            <Field label="UPI ID" optional error={upiError}>
              {(p) => (
                <Input
                  {...p}
                  value={payment.upiId}
                  onChange={(e) => patchPayment({ upiId: e.target.value.trim() })}
                  placeholder="yourname@bank"
                />
              )}
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          title="Default pay-by-QR"
          description="Prefills the QR on new invoices. Every invoice can override it."
        >
          <ImageUploader
            label="Default payment QR"
            hint="PNG, JPG or WEBP up to 512 KB. Square images scan most reliably."
            kind="payment-qr"
            url={payment.qr.imageUrl}
            onChange={(imageUrl) => patchPayment({ qr: { ...payment.qr, mode: "upload", imageUrl } })}
            authenticated={authenticated}
            shape="square"
          />
          {payment.qr.mode !== "none" ? (
            <>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-shell-100 px-3 py-2.5">
                <span className="text-xs font-medium text-shell-700">Lock the amount in generated codes</span>
                <Switch
                  checked={payment.qr.includeAmount}
                  onChange={(includeAmount) => patchPayment({ qr: { ...payment.qr, includeAmount } })}
                  label="Lock the amount in generated codes"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={payment.qr.mode === "upload" ? "primary" : "ghost"}
                  onClick={() => patchPayment({ qr: { ...payment.qr, mode: "upload" } })}
                  disabled={!payment.qr.imageUrl}
                >
                  Use my uploaded image
                </Button>
                <Button
                  size="sm"
                  variant={payment.qr.mode === "upi" ? "primary" : "ghost"}
                  onClick={() => patchPayment({ qr: { ...payment.qr, mode: "upi" } })}
                  disabled={!payment.upiId || Boolean(upiError)}
                >
                  Generate from my UPI ID
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => patchPayment({ qr: { ...payment.qr, mode: "none" } })}
                >
                  Off
                </Button>
              </div>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                patchPayment({ qr: { ...payment.qr, mode: payment.qr.imageUrl ? "upload" : "upi" } })
              }
              disabled={!payment.qr.imageUrl && !payment.upiId}
            >
              Show a QR on new invoices
            </Button>
          )}
        </SectionCard>

        <SectionCard title="Default terms & notes" description="Prefilled on new invoices. One clause per line.">
          <Field label="Terms" optional>
            {(p) => <Textarea {...p} rows={5} value={profile.defaultTerms} onChange={(e) => patch((p) => ({ ...p, defaultTerms: e.target.value }))} />}
          </Field>
          <Field label="Notes" optional>
            {(p) => <Textarea {...p} rows={3} value={profile.defaultNotes} onChange={(e) => patch((p) => ({ ...p, defaultNotes: e.target.value }))} maxLength={600} />}
          </Field>
        </SectionCard>

        <SectionCard title="Signature" description="Prefilled on new invoices.">
          <ImageUploader
            label="Signature image"
            hint="Optional. Transparent PNGs work best. The signature is never stretched."
            kind="signature"
            url={signature.imageUrl}
            onChange={(imageUrl) => patchSignature({ imageUrl })}
            authenticated={authenticated}
            shape="signature"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Signatory name" optional>
              {(p) => <Input {...p} value={signature.name} onChange={(e) => patchSignature({ name: e.target.value })} />}
            </Field>
            <Field label="Designation" optional>
              {(p) => (
                <Input
                  {...p}
                  value={signature.designation}
                  onChange={(e) => patchSignature({ designation: e.target.value })}
                  placeholder="Authorised Signatory"
                />
              )}
            </Field>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
