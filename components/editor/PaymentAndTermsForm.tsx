"use client";

import { formatINR } from "@/lib/formatting/inr";
import { DEFAULT_NOTES, DEFAULT_TERMS } from "@/lib/invoice/defaults";
import { useInvoiceStore } from "@/lib/store/invoice-store";
import { validateIFSC, validateUPI } from "@/lib/validation/gstin";
import { Button, Disclosure, Field, Input, SectionCard, Textarea } from "@/components/ui";
import { ImageUploader } from "./ImageUploader";
import { PaymentQrField } from "./PaymentQrField";

const NOTE_PRESETS = [
  "Thank you for your business.",
  "Payment received with thanks.",
  "Please contact us for any invoice-related queries.",
];

export function PaymentAndTermsForm({ authenticated }: { authenticated: boolean }) {
  const payment = useInvoiceStore((s) => s.invoice.payment);
  const signature = useInvoiceStore((s) => s.invoice.signature);
  const terms = useInvoiceStore((s) => s.invoice.terms);
  const notes = useInvoiceStore((s) => s.invoice.notes);
  const totals = useInvoiceStore((s) => s.totals)();
  const { patchBank, patchPayment, patchSignature, setTerms, setNotes } = useInvoiceStore.getState();

  const ifscError =
    payment.bank.ifsc && !validateIFSC(payment.bank.ifsc)
      ? "Enter a valid IFSC such as HDFC0001234, or leave it empty."
      : undefined;
  const upiError =
    payment.upiId && !validateUPI(payment.upiId)
      ? "Enter a valid UPI ID such as name@bank, or leave it empty."
      : undefined;

  return (
    <>
      <SectionCard
        title="Payment details"
        description="Everything here is optional. Empty blocks never appear on the invoice."
      >
        <Disclosure title="Bank & UPI details" defaultOpen>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Account name" optional>
              {(p) => (
                <Input
                  {...p}
                  value={payment.bank.accountName}
                  onChange={(e) => patchBank({ accountName: e.target.value })}
                />
              )}
            </Field>
            <Field label="Bank name" optional>
              {(p) => (
                <Input
                  {...p}
                  value={payment.bank.bankName}
                  onChange={(e) => patchBank({ bankName: e.target.value })}
                />
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
              {(p) => (
                <Input
                  {...p}
                  value={payment.bank.branch}
                  onChange={(e) => patchBank({ branch: e.target.value })}
                />
              )}
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

          <Field label="Payment link" optional hint="A UPI or gateway link clients can open to pay.">
            {(p) => (
              <Input
                {...p}
                value={payment.paymentLink}
                onChange={(e) => patchPayment({ paymentLink: e.target.value.trim() })}
                placeholder="https://pay.example.com/abc123"
              />
            )}
          </Field>

          <Field label="Payment note" optional>
            {(p) => (
              <Textarea
                {...p}
                rows={2}
                value={payment.paymentNote}
                onChange={(e) => patchPayment({ paymentNote: e.target.value })}
                placeholder="Add 6% processing fee, or pay within 7 days."
              />
            )}
          </Field>
        </Disclosure>

        <div className="rounded-lg bg-shell-100 px-3 py-2.5 text-[11px] text-shell-600">
          {totals.advanceMinor > 0 ? "Balance payable" : "Amount payable"}:{" "}
          <strong className="tabular">{formatINR(totals.balanceDueMinor)}</strong>
        </div>

        <Disclosure
          title="Pay-by-QR code"
          badge={payment.qr.mode === "none" ? undefined : payment.qr.mode === "upi" ? "Generated" : "Uploaded"}
        >
          <PaymentQrField authenticated={authenticated} />
        </Disclosure>
      </SectionCard>

      <SectionCard title="Signature" description="Optional. Add your authorised signature to the invoice.">
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
            {(p) => (
              <Input
                {...p}
                value={signature.name}
                onChange={(e) => patchSignature({ name: e.target.value })}
              />
            )}
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

      <SectionCard
        title="Terms & conditions"
        description="Editable sample wording — not legal advice. One clause per line."
      >
        <Field label="Terms" optional>
          {(p) => (
            <Textarea
              {...p}
              rows={5}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder={DEFAULT_TERMS}
            />
          )}
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setTerms(DEFAULT_TERMS)}>
            Reset to sample terms
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setTerms("")}>
            Clear terms
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Notes" description="A short closing message.">
        <Field label="Note" optional>
          {(p) => (
            <Textarea
              {...p}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={600}
              placeholder={DEFAULT_NOTES}
            />
          )}
        </Field>
        <div className="flex flex-wrap gap-2">
          {NOTE_PRESETS.map((preset) => (
            <Button key={preset} type="button" size="sm" variant="ghost" onClick={() => setNotes(preset)}>
              {preset.length > 30 ? `${preset.slice(0, 30)}…` : preset}
            </Button>
          ))}
        </div>
      </SectionCard>
    </>
  );
}
