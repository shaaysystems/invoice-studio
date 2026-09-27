"use client";

import { useInvoiceStore } from "@/lib/store/invoice-store";
import { validateGSTIN, validatePAN } from "@/lib/validation/gstin";
import { Disclosure, Field, Input, SectionCard, Textarea } from "@/components/ui";
import { ImageUploader } from "./ImageUploader";

export function BusinessForm({ authenticated }: { authenticated: boolean }) {
  const business = useInvoiceStore((s) => s.invoice.business);
  const logoOverrideUrl = useInvoiceStore((s) => s.invoice.logoOverrideUrl);
  const patchBusiness = useInvoiceStore((s) => s.patchBusiness);
  const patchAddress = useInvoiceStore((s) => s.patchBusinessAddress);
  const patchSocial = useInvoiceStore((s) => s.patchBusinessSocial);
  const { patchLogoOverride } = useInvoiceStore.getState();

  const gstinError = business.gstin && !validateGSTIN(business.gstin) ? "Enter a valid GSTIN or leave the field empty." : undefined;
  const panError = business.pan && !validatePAN(business.pan) ? "Enter a valid PAN such as ABCDE1234F, or leave it empty." : undefined;

  return (
    <SectionCard title="Your business" description="This appears as the sender on your invoice.">
      <Field label="Business name" hint="Shown as the invoice sender.">
        {(p) => (
          <Input
            {...p}
            value={business.name}
            onChange={(e) => patchBusiness({ name: e.target.value })}
            placeholder="Northstar Creative Studio"
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone" optional>
          {(p) => (
            <Input
              {...p}
              type="tel"
              value={business.phone}
              onChange={(e) => patchBusiness({ phone: e.target.value })}
              placeholder="+91 98765 43210"
            />
          )}
        </Field>
        <Field label="Email" optional>
          {(p) => (
            <Input
              {...p}
              type="email"
              value={business.email}
              onChange={(e) => patchBusiness({ email: e.target.value })}
            />
          )}
        </Field>
      </div>

      <ImageUploader
        label="Logo"
        hint="PNG, JPG, WEBP or SVG up to 2 MB. Your logo is never cropped or stretched. This is your default and applies to every new invoice."
        kind="logo"
        url={business.logoUrl}
        onChange={(logoUrl) => patchBusiness({ logoUrl })}
        authenticated={authenticated}
      />

      <Disclosure
        title="Use a different logo on this invoice"
        badge={logoOverrideUrl ? "Custom" : undefined}
      >
        <ImageUploader
          label="This invoice's logo"
          hint="Overrides the logo above for this invoice only. Clear it to fall back to your default."
          kind="logo"
          url={logoOverrideUrl}
          onChange={patchLogoOverride}
          authenticated={authenticated}
        />
      </Disclosure>

      <Disclosure title="Address and legal details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Website" optional>
            {(p) => (
              <Input
                {...p}
                value={business.socials.website}
                onChange={(e) => patchSocial({ website: e.target.value })}
                placeholder="studio.com"
              />
            )}
          </Field>
          <Field label="Legal name" optional hint="Used on tax invoices when it differs.">
            {(p) => (
              <Input
                {...p}
                value={business.legalName}
                onChange={(e) => patchBusiness({ legalName: e.target.value })}
              />
            )}
          </Field>
        </div>

        <Field label="Address line 1" optional>
          {(p) => (
            <Textarea
              {...p}
              rows={2}
              value={business.address.line1}
              onChange={(e) => patchAddress({ line1: e.target.value })}
            />
          )}
        </Field>
        <Field label="Address line 2" optional>
          {(p) => (
            <Input
              {...p}
              value={business.address.line2}
              onChange={(e) => patchAddress({ line2: e.target.value })}
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="City" optional>
            {(p) => (
              <Input {...p} value={business.address.city} onChange={(e) => patchAddress({ city: e.target.value })} />
            )}
          </Field>
          <Field label="State" optional>
            {(p) => (
              <Input {...p} value={business.address.state} onChange={(e) => patchAddress({ state: e.target.value })} />
            )}
          </Field>
          <Field label="State code" optional hint="Two letters, e.g. MH.">
            {(p) => (
              <Input
                {...p}
                maxLength={2}
                className="uppercase"
                value={business.address.stateCode}
                onChange={(e) => patchAddress({ stateCode: e.target.value.toUpperCase() })}
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
                value={business.address.pincode}
                onChange={(e) => patchAddress({ pincode: e.target.value })}
              />
            )}
          </Field>
          <Field label="Country" optional>
            {(p) => (
              <Input
                {...p}
                value={business.address.country}
                onChange={(e) => patchAddress({ country: e.target.value })}
                placeholder="India"
              />
            )}
          </Field>
        </div>
      </Disclosure>

      <Disclosure title="GST & tax identifiers" badge={business.gstin ? "GSTIN added" : undefined}>
        <Field
          label="GSTIN"
          optional
          error={gstinError}
          hint="Optional. Adding a GSTIN unlocks GST controls in the Items tab."
        >
          {(p) => (
            <Input
              {...p}
              value={business.gstin}
              onChange={(e) => patchBusiness({ gstin: e.target.value.toUpperCase().trim() })}
              maxLength={15}
              placeholder="32AAAAA0000A1Z5"
              className="font-mono uppercase"
            />
          )}
        </Field>
        <Field label="PAN" optional error={panError}>
          {(p) => (
            <Input
              {...p}
              value={business.pan}
              onChange={(e) => patchBusiness({ pan: e.target.value.toUpperCase() })}
              maxLength={10}
              placeholder="ABCDE1234F"
              className="font-mono uppercase"
            />
          )}
        </Field>
      </Disclosure>

      <Disclosure title="Social links">
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ["website", "Website"],
              ["instagram", "Instagram"],
              ["linkedin", "LinkedIn"],
              ["twitter", "X / Twitter"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label} optional>
              {(p) => (
                <Input
                  {...p}
                  value={business.socials[key]}
                  onChange={(e) => patchSocial({ [key]: e.target.value })}
                />
              )}
            </Field>
          ))}
        </div>
        <p className="text-[11px] text-shell-500">Only the links you fill in appear on the invoice.</p>
      </Disclosure>
    </SectionCard>
  );
}
