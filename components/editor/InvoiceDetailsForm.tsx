"use client";

import { RefreshCw } from "lucide-react";
import { defaultPrefix, generateInvoiceNumber } from "@/lib/invoice/numbering";
import { useInvoiceStore } from "@/lib/store/invoice-store";
import { addDaysISO } from "@/lib/formatting/inr";
import { Alert, Button, Field, Input, SectionCard, Select } from "@/components/ui";

export function InvoiceDetailsForm() {
  const invoice = useInvoiceStore((s) => s.invoice);
  const patch = useInvoiceStore((s) => s.patchDetails);

  const dueBeforeInvoice = Boolean(invoice.dueDate && invoice.dueDate < invoice.issueDate);

  return (
    <SectionCard title="Invoice details" description="Numbering, dates and place of supply.">
      <Field label="Invoice number" hint="Type your own, or generate one from the current year.">
        {(p) => (
          <div className="flex gap-2">
            <Input
              {...p}
              value={invoice.number}
              onChange={(e) => patch({ number: e.target.value })}
              placeholder="INV-2026-001"
            />
            <Button
              type="button"
              variant="secondary"
              aria-label="Auto-fill invoice number"
              title="Auto-fill invoice number"
              onClick={() =>
                patch({
                  number: generateInvoiceNumber({
                    prefix: defaultPrefix(),
                    nextSequence: 1,
                    padding: 3,
                  }),
                })
              }
            >
              <RefreshCw className="size-3.5" aria-hidden />
            </Button>
          </div>
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Invoice date">
          {(p) => (
            <Input
              {...p}
              type="date"
              value={invoice.issueDate}
              onChange={(e) => patch({ issueDate: e.target.value })}
            />
          )}
        </Field>
        <Field label="Due date" optional>
          {(p) => (
            <Input
              {...p}
              type="date"
              value={invoice.dueDate}
              onChange={(e) => patch({ dueDate: e.target.value })}
            />
          )}
        </Field>
      </div>

      <div className="flex flex-wrap gap-2">
        {[7, 15, 30].map((days) => (
          <Button
            key={days}
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => patch({ dueDate: addDaysISO(invoice.issueDate, days) })}
          >
            Due in {days} days
          </Button>
        ))}
      </div>

      {/* Warn, never overwrite the user's dates. */}
      {dueBeforeInvoice ? (
        <Alert tone="warning" title="Check the dates">
          The due date is before the invoice date. You can still export, but most clients expect the due date to
          fall on or after the invoice date.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="PO number" optional>
          {(p) => (
            <Input
              {...p}
              value={invoice.poNumber}
              onChange={(e) => patch({ poNumber: e.target.value })}
              placeholder="PO-2026-118"
            />
          )}
        </Field>
        <Field label="Place of supply" optional hint="Two-letter state code shown on GST invoices.">
          {(p) => (
            <Input
              {...p}
              maxLength={2}
              className="uppercase"
              value={invoice.placeOfSupply}
              onChange={(e) => patch({ placeOfSupply: e.target.value.toUpperCase() })}
              placeholder="MH"
            />
          )}
        </Field>
      </div>

      <Field label="Currency" hint="Additional currencies are planned. INR is applied throughout, including exports.">
        {(p) => (
          <Select {...p} value={invoice.currency} onChange={() => undefined} disabled>
            <option value="INR">INR — Indian Rupee (₹)</option>
          </Select>
        )}
      </Field>
    </SectionCard>
  );
}
