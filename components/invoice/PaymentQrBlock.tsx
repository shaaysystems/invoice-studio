import { QR_SIZE } from "@/lib/invoice/layout-metrics";
import type { InvoiceTokens } from "@/lib/brand/tokens";
import type { ResolvedPaymentQr } from "@/lib/payment/qr";

interface Props {
  qr: ResolvedPaymentQr;
  tokens: InvoiceTokens;
}

/**
 * Pay-by-QR block. The code is printed at a fixed size on a white quiet zone so
 * it stays scannable after the invoice is printed, photocopied or sent as a
 * JPEG over WhatsApp.
 */
export function PaymentQrBlock({ qr, tokens }: Props) {
  return (
    <div style={{ textAlign: "center", width: `${QR_SIZE + 12}pt`, flexShrink: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qr.src}
        alt={qr.label ? `${qr.label} — payment QR code` : "Payment QR code"}
        crossOrigin="anonymous"
        style={{
          width: `${QR_SIZE}pt`,
          height: `${QR_SIZE}pt`,
          objectFit: "contain",
          // A white plate keeps the code readable on a tinted brand surface.
          backgroundColor: "#ffffff",
          padding: "3pt",
          border: `0.5pt solid ${tokens.rule}`,
          borderRadius: "3pt",
        }}
      />
      {qr.label ? (
        <div style={{ marginTop: "4pt", fontSize: "7.4pt", fontWeight: 600, color: tokens.ink }}>{qr.label}</div>
      ) : null}
      {qr.amountText ? (
        <div style={{ marginTop: "1pt", fontSize: "7.6pt", color: tokens.inkMuted }}>{qr.amountText}</div>
      ) : null}
    </div>
  );
}
