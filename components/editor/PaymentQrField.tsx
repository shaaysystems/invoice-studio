"use client";

import { formatINR } from "@/lib/formatting/inr";
import { paymentQrPayload } from "@/lib/payment/qr";
import { useInvoiceStore } from "@/lib/store/invoice-store";
import { validateUPI } from "@/lib/validation/gstin";
import { Alert, Disclosure, Field, Input, SegmentedControl, Switch } from "@/components/ui";
import { ImageUploader } from "./ImageUploader";
import type { PaymentQrMode } from "@/types/invoice";

const MODE_OPTIONS: { value: PaymentQrMode; label: string }[] = [
  { value: "none", label: "No QR" },
  { value: "upi", label: "Auto-generate" },
  { value: "upload", label: "Upload image" },
];

function CaptionField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Field label="Caption" optional>
      {(p) => (
        <Input
          {...p}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={60}
          placeholder="Scan to pay"
        />
      )}
    </Field>
  );
}

/**
 * Two ways to get a scannable code onto the invoice: upload the one your bank
 * or UPI app already gave you, or let us build a UPI deep link that carries the
 * exact amount. The generated option is the one that removes typing for the
 * payer, so it is offered first.
 */
export function PaymentQrField({ authenticated }: { authenticated: boolean }) {
  const invoice = useInvoiceStore((s) => s.invoice);
  const qr = invoice.payment.qr;
  const upiId = invoice.payment.upiId;
  const totals = useInvoiceStore((s) => s.totals)();
  const { patchPaymentQr } = useInvoiceStore.getState();

  const upiValid = validateUPI(upiId);
  const payload = qr.mode === "upi" && upiValid ? paymentQrPayload(invoice, totals) : null;

  return (
    <div className="space-y-3">
      <SegmentedControl
        label="Payment QR mode"
        value={qr.mode}
        onChange={(mode) => patchPaymentQr({ mode })}
        options={MODE_OPTIONS}
      />

      {qr.mode === "none" ? (
        <Disclosure title="Where does the code go?">
          <p className="text-[11px] leading-relaxed text-shell-500">
            The code prints beside your bank details, in the exported PDF and in the JPEG — so a client can scan it
            straight from the invoice you send them.
          </p>
        </Disclosure>
      ) : null}

      {qr.mode === "upi" ? (
        <div className="space-y-3">
          {upiValid ? null : (
            <Alert tone="warning" title="Add your UPI ID first">
              A generated code needs a UPI ID such as <code className="font-mono">name@bank</code>. Add one in the
              bank &amp; UPI details above.
            </Alert>
          )}

          <div className="flex items-center justify-between gap-3 rounded-lg bg-shell-100 px-3 py-2.5">
            <span className="text-xs font-medium text-shell-700">Lock the amount in the code</span>
            <Switch
              checked={qr.includeAmount}
              onChange={(includeAmount) => patchPaymentQr({ includeAmount })}
              label="Lock the amount in the code"
            />
          </div>

          <p className="text-[11px] leading-snug text-shell-500">
            {qr.includeAmount ? (
              <>
                The payer opens their UPI app with{" "}
                <strong className="tabular text-shell-700">{formatINR(totals.balanceDueMinor)}</strong> already
                filled in, so they only confirm. It follows the balance due as it changes.
              </>
            ) : (
              "The code carries no amount, so the payer types it in themselves."
            )}
          </p>

          {payload ? <CaptionField value={qr.label} onChange={(label) => patchPaymentQr({ label })} /> : null}

          {payload ? (
            <p className="break-all rounded-lg bg-shell-50 px-3 py-2 font-mono text-[10px] leading-relaxed text-shell-500">
              {payload}
            </p>
          ) : null}
        </div>
      ) : null}

      {qr.mode === "upload" ? (
        <div className="space-y-3">
          <ImageUploader
            label="Payment QR image"
            hint="PNG, JPG or WEBP up to 512 KB. Square images scan most reliably. This is the code your clients will scan to pay."
            kind="payment-qr"
            url={qr.imageUrl}
            onChange={(imageUrl) => patchPaymentQr({ imageUrl })}
            authenticated={authenticated}
            shape="square"
          />
          {qr.imageUrl ? <CaptionField value={qr.label} onChange={(label) => patchPaymentQr({ label })} /> : null}
        </div>
      ) : null}
    </div>
  );
}
