"use client";

import { formatINR } from "@/lib/formatting/inr";
import { TAX_DISCLAIMER } from "@/lib/invoice/defaults";
import { minorToInputValue, rupeesToMinor } from "@/lib/money";
import { useInvoiceStore } from "@/lib/store/invoice-store";
import {
  Alert,
  Disclosure,
  Field,
  Input,
  SectionCard,
  SegmentedControl,
  Select,
  Switch,
  Tooltip,
} from "@/components/ui";
import type { GstScope, TaxMode } from "@/types/invoice";

export function TaxSettings() {
  const invoice = useInvoiceStore((s) => s.invoice);
  const patchTax = useInvoiceStore((s) => s.patchTax);
  const patchAdjustments = useInvoiceStore((s) => s.patchAdjustments);
  const totals = useInvoiceStore((s) => s.totals)();

  const gst = invoice.taxMode === "gst";

  return (
    <SectionCard title="Tax & adjustments" description="Both are optional. The invoice works perfectly without them.">
      <div className="flex items-center gap-2">
        <SegmentedControl<TaxMode>
          label="Tax mode"
          value={invoice.taxMode}
          onChange={(taxMode) => patchTax({ taxMode })}
          options={[
            { value: "none", label: "No tax" },
            { value: "gst", label: "GST" },
          ]}
        />
        <Tooltip text="Optional. Add GST details if applicable to your business.">
          <span
            tabIndex={0}
            role="img"
            aria-label="Optional. Add GST details if applicable to your business."
            className="grid size-4 cursor-help place-items-center rounded-full border border-shell-300 text-[9px] text-shell-500"
          >
            i
          </span>
        </Tooltip>
      </div>

      {gst ? (
        <>
          <Field
            label="Supply type"
            hint="Intra-state supplies split GST into CGST and SGST; inter-state supplies use IGST."
          >
            {(p) => (
              <Select
                {...p}
                value={invoice.gstScope}
                onChange={(e) => patchTax({ gstScope: e.target.value as GstScope })}
              >
                <option value="intra">Intra-state — CGST + SGST</option>
                <option value="inter">Inter-state — IGST</option>
              </Select>
            )}
          </Field>

          <div className="flex items-center justify-between rounded-lg bg-shell-50 px-3 py-2.5">
            <span className="text-xs font-medium text-shell-700">Rates already include tax</span>
            <Switch
              checked={invoice.pricesIncludeTax}
              onChange={(pricesIncludeTax) => patchTax({ pricesIncludeTax })}
              label="Rates already include tax"
            />
          </div>

          <Disclosure title="Tax summary">
            <div className="space-y-1.5">
              {totals.buckets.length === 0 ? (
                <p className="text-[11px] text-shell-500">No taxed lines yet.</p>
              ) : (
                totals.buckets.map((bucket) => (
                  <div
                    key={bucket.rate}
                    className="flex items-center justify-between rounded-md bg-shell-50 px-3 py-2 text-[11px]"
                  >
                    <span className="tabular text-shell-600">
                      {bucket.rate}% on {formatINR(bucket.taxableMinor)}
                    </span>
                    <span className="tabular font-medium text-shell-900">
                      {invoice.gstScope === "intra"
                        ? `${formatINR(bucket.cgstMinor)} + ${formatINR(bucket.sgstMinor)}`
                        : formatINR(bucket.igstMinor)}
                    </span>
                  </div>
                ))
              )}
            </div>
            <Alert tone="info">{TAX_DISCLAIMER}</Alert>
          </Disclosure>
        </>
      ) : null}

      <Disclosure
        title="Invoice discount"
        badge={invoice.globalDiscountType !== "none" ? "Enabled" : undefined}
      >
        <SegmentedControl
          label="Discount type"
          value={invoice.globalDiscountType}
          onChange={(globalDiscountType) => patchAdjustments({ globalDiscountType, globalDiscountValue: 0 })}
          options={[
            { value: "none", label: "None" },
            { value: "percent", label: "Percentage" },
            { value: "amount", label: "Fixed ₹" },
          ]}
        />

        {invoice.globalDiscountType === "percent" ? (
          <Field label="Discount (%)">
            {(p) => (
              <Input
                {...p}
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={String(invoice.globalDiscountValue)}
                onChange={(e) => patchAdjustments({ globalDiscountValue: Number(e.target.value) || 0 })}
              />
            )}
          </Field>
        ) : null}

        {invoice.globalDiscountType === "amount" ? (
          <Field label="Discount amount (₹)">
            {(p) => (
              <Input
                {...p}
                type="number"
                min="0"
                step="0.01"
                value={minorToInputValue(
                  invoice.globalDiscountType === "amount" ? invoice.globalDiscountValue : 0,
                )}
                onChange={(e) => patchAdjustments({ globalDiscountValue: rupeesToMinor(e.target.value) })}
              />
            )}
          </Field>
        ) : null}

        <p className="text-[11px] text-shell-500">
          Applied after line discounts and before tax, spread proportionally across items. Current discount:{" "}
          <strong>{formatINR(totals.globalDiscountMinor)}</strong>.
        </p>
      </Disclosure>

      <Disclosure title="Shipping, advance, round-off & totals">
        <Field label="Shipping (₹)" optional>
          {(p) => (
            <Input
              {...p}
              type="number"
              min="0"
              step="0.01"
              value={minorToInputValue(invoice.shippingMinor)}
              onChange={(e) => patchAdjustments({ shippingMinor: rupeesToMinor(e.target.value) })}
            />
          )}
        </Field>

        <Field
          label="Advance already paid (₹)"
          optional
          hint="If the client has already paid you, enter that amount. It is deducted from the invoice total and the balance becomes the amount due."
        >
          {(p) => (
            <Input
              {...p}
              type="number"
              min="0"
              step="0.01"
              value={minorToInputValue(invoice.advanceMinor)}
              onChange={(e) => patchAdjustments({ advanceMinor: rupeesToMinor(e.target.value) })}
            />
          )}
        </Field>

        {totals.advanceMinor > 0 ? (
          <div className="space-y-1 rounded-lg bg-shell-50 px-3 py-2.5 text-[11px] text-shell-500">
            <p>
              Invoice total <strong className="tabular text-shell-700">{formatINR(totals.grandTotalMinor)}</strong>
              {" − "}
              advance <strong className="tabular text-shell-700">{formatINR(totals.advanceMinor)}</strong> ={" "}
              <strong className="tabular text-shell-700">balance {formatINR(totals.balanceDueMinor)}</strong>.
            </p>
            {invoice.advanceMinor > totals.grandTotalMinor ? (
              <Alert tone="warning">
                The advance is more than the invoice total, so it has been capped at {formatINR(totals.grandTotalMinor)}{" "}
                and the balance is {formatINR(0)}.
              </Alert>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-between rounded-lg bg-shell-50 px-3 py-2.5">
          <span className="text-xs font-medium text-shell-700">Round off to the nearest rupee</span>
          <Switch
            checked={invoice.roundOffEnabled}
            onChange={(roundOffEnabled) => patchAdjustments({ roundOffEnabled })}
            label="Round off to the nearest rupee"
          />
        </div>

        <div className="flex items-center justify-between rounded-lg bg-shell-50 px-3 py-2.5">
          <span className="text-xs font-medium text-shell-700">Round off to the nearest rupee</span>
          <Switch
            checked={invoice.roundOffEnabled}
            onChange={(roundOffEnabled) => patchAdjustments({ roundOffEnabled })}
            label="Round off to the nearest rupee"
          />
        </div>

      </Disclosure>
    </SectionCard>
  );
}
