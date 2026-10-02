"use client";

import { useInvoiceStore } from "@/lib/store/invoice-store";
import { validateGSTIN } from "@/lib/validation/gstin";
import { Disclosure, Field, Input, SectionCard, Switch, Textarea } from "@/components/ui";
import { ImageUploader } from "./ImageUploader";

export function ClientForm({ authenticated }: { authenticated: boolean }) {
  const client = useInvoiceStore((s) => s.invoice.client);
  const patchClient = useInvoiceStore((s) => s.patchClient);
  const patchAddress = useInvoiceStore((s) => s.patchClientAddress);
  const patchShipping = useInvoiceStore((s) => s.patchClientShippingAddress);

  const gstinError =
    client.gstin && !validateGSTIN(client.gstin) ? "Enter a valid GSTIN or leave the field empty." : undefined;

  return (
    <SectionCard title="Bill to" description="Who is being invoiced.">
      <Field label="Client name">
        {(p) => (
          <Input
            {...p}
            value={client.name}
            onChange={(e) => patchClient({ name: e.target.value })}
            placeholder="Acme Technologies Pvt. Ltd."
          />
        )}
      </Field>

      <ImageUploader
        label="Client logo"
        hint="Printed beside the client name in the Bill to block. PNG, JPG, WEBP or SVG up to 2 MB. Applies to this invoice only."
        kind="logo"
        shape="square"
        url={client.logoUrl}
        onChange={(logoUrl) => patchClient({ logoUrl })}
        authenticated={authenticated}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" optional>
          {(p) => (
            <Input
              {...p}
              type="email"
              value={client.email}
              onChange={(e) => patchClient({ email: e.target.value })}
            />
          )}
        </Field>
        <Field label="Phone" optional>
          {(p) => (
            <Input
              {...p}
              type="tel"
              value={client.phone}
              onChange={(e) => patchClient({ phone: e.target.value })}
            />
          )}
        </Field>
      </div>

      <Disclosure title="Billing address">
        <Field label="Address line 1" optional>
          {(p) => (
            <Textarea
              {...p}
              rows={2}
              value={client.billingAddress.line1}
              onChange={(e) => patchAddress({ line1: e.target.value })}
            />
          )}
        </Field>
        <Field label="Address line 2" optional>
          {(p) => (
            <Input
              {...p}
              value={client.billingAddress.line2}
              onChange={(e) => patchAddress({ line2: e.target.value })}
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="City" optional>
            {(p) => (
              <Input
                {...p}
                value={client.billingAddress.city}
                onChange={(e) => patchAddress({ city: e.target.value })}
              />
            )}
          </Field>
          <Field label="State" optional>
            {(p) => (
              <Input
                {...p}
                value={client.billingAddress.state}
                onChange={(e) => patchAddress({ state: e.target.value })}
              />
            )}
          </Field>
          <Field label="State code" optional hint="Two letters, e.g. KA.">
            {(p) => (
              <Input
                {...p}
                maxLength={2}
                className="uppercase"
                value={client.billingAddress.stateCode}
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
                value={client.billingAddress.pincode}
                onChange={(e) => patchAddress({ pincode: e.target.value })}
              />
            )}
          </Field>
          <Field label="Country" optional>
            {(p) => (
              <Input
                {...p}
                value={client.billingAddress.country}
                onChange={(e) => patchAddress({ country: e.target.value })}
                placeholder="India"
              />
            )}
          </Field>
        </div>
      </Disclosure>

      <div className="flex items-center justify-between rounded-lg bg-shell-50 px-3 py-2.5">
        <span className="text-xs font-medium text-shell-700">Ship to a different address</span>
        <Switch
          checked={!client.shipToSameAsBillTo}
          onChange={(different) => patchClient({ shipToSameAsBillTo: !different })}
          label="Ship to a different address"
        />
      </div>

      {!client.shipToSameAsBillTo ? (
        <Disclosure title="Shipping address" defaultOpen>
          <Field label="Shipping address line 1" optional>
            {(p) => (
              <Textarea
                {...p}
                rows={2}
                value={client.shippingAddress.line1}
                onChange={(e) => patchShipping({ line1: e.target.value })}
              />
            )}
          </Field>
          <Field label="Shipping address line 2" optional>
            {(p) => (
              <Input
                {...p}
                value={client.shippingAddress.line2}
                onChange={(e) => patchShipping({ line2: e.target.value })}
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Shipping city" optional>
              {(p) => (
                <Input
                  {...p}
                  value={client.shippingAddress.city}
                  onChange={(e) => patchShipping({ city: e.target.value })}
                />
              )}
            </Field>
            <Field label="Shipping state" optional>
              {(p) => (
                <Input
                  {...p}
                  value={client.shippingAddress.state}
                  onChange={(e) => patchShipping({ state: e.target.value })}
                />
              )}
            </Field>
            <Field label="Shipping state code" optional>
              {(p) => (
                <Input
                  {...p}
                  maxLength={2}
                  className="uppercase"
                  value={client.shippingAddress.stateCode}
                  onChange={(e) => patchShipping({ stateCode: e.target.value.toUpperCase() })}
                />
              )}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Shipping PIN code" optional>
              {(p) => (
                <Input
                  {...p}
                  inputMode="numeric"
                  maxLength={6}
                  value={client.shippingAddress.pincode}
                  onChange={(e) => patchShipping({ pincode: e.target.value })}
                />
              )}
            </Field>
            <Field label="Shipping country" optional>
              {(p) => (
                <Input
                  {...p}
                  value={client.shippingAddress.country}
                  onChange={(e) => patchShipping({ country: e.target.value })}
                  placeholder="India"
                />
              )}
            </Field>
          </div>
        </Disclosure>
      ) : null}

      <Disclosure title="Client GSTIN" badge={client.gstin ? "GSTIN added" : undefined}>
        <Field label="Client GSTIN" optional error={gstinError}>
          {(p) => (
            <Input
              {...p}
              value={client.gstin}
              onChange={(e) => patchClient({ gstin: e.target.value.toUpperCase().trim() })}
              maxLength={15}
              className="font-mono uppercase"
              placeholder="29AAAAA0000A1Z5"
            />
          )}
        </Field>
        <Field label="Client PAN" optional>
          {(p) => (
            <Input
              {...p}
              value={client.pan}
              onChange={(e) => patchClient({ pan: e.target.value.toUpperCase() })}
              maxLength={10}
              className="font-mono uppercase"
              placeholder="AAACA1234C"
            />
          )}
        </Field>
      </Disclosure>
    </SectionCard>
  );
}
