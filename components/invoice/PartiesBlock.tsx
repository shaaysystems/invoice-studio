import { formatInvoiceDate } from "@/lib/formatting/inr";
import {
  effectiveClientAddress,
  formatAddressLines,
  hasBusinessAddress,
  hasClientAddress,
  partyLines,
  visibleSocialLinks,
} from "@/lib/invoice/presence";
import type { InvoiceTokens } from "@/lib/brand/tokens";
import type { Address, Invoice } from "@/types/invoice";
import { SectionLabel, TextLine } from "./primitives";

function addressLines(address: Address): string[] {
  return formatAddressLines(address);
}

interface Props {
  invoice: Invoice;
  tokens: InvoiceTokens;
}

export function PartiesBlock({ invoice, tokens }: Props) {
  const { business, client } = invoice;
  const isGst = invoice.taxMode === "gst";

  const businessContact = partyLines([
    ["Phone", business.phone],
    ["Email", business.email],
    ["GSTIN", business.gstin],
    ["PAN", business.pan],
  ]);
  const socials = visibleSocialLinks(business.socials);

  const clientContact = partyLines([
    ["Phone", client.phone],
    ["Email", client.email],
    ["GSTIN", client.gstin],
    ["PAN", client.pan],
  ]);

  const meta = partyLines([
    ["Invoice date", formatInvoiceDate(invoice.issueDate)],
    ["Due date", formatInvoiceDate(invoice.dueDate)],
    ["Place of supply", isGst ? invoice.placeOfSupply : ""],
    ["PO number", invoice.poNumber],
  ]);

  const shipTo = effectiveClientAddress(client);
  const showShip = !client.shipToSameAsBillTo && hasAddressContent(shipTo);

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1.05fr 0.8fr",
        gap: "18pt",
        paddingTop: "14pt",
        marginTop: "14pt",
        borderTop: `0.75pt solid ${tokens.rule}`,
      }}
    >
      {/* ---------- From ---------- */}
      <div style={{ minWidth: 0 }}>
        <SectionLabel color={tokens.inkSubtle}>From</SectionLabel>
        {hasBusinessAddress(invoice)
          ? addressLines(business.address).map((line) => (
              <TextLine key={line} value={line} color={tokens.inkMuted} size={8.2} />
            ))
          : null}
        <div style={{ marginTop: businessContact.length ? "4pt" : 0 }}>
          {businessContact.map(([label, value]) => (
            <TextLine key={label} value={`${label} · ${value}`} color={tokens.inkMuted} size={8} />
          ))}
        </div>
        {socials.length ? (
          <TextLine
            value={socials.map((s) => `${s.label} ${s.value}`).join("  ·  ")}
            color={tokens.inkSubtle}
            size={7.6}
            className="mt-1"
          />
        ) : null}
      </div>

      {/* ---------- Bill to ---------- */}
      <div style={{ minWidth: 0 }}>
        <SectionLabel color={tokens.inkSubtle}>Bill to</SectionLabel>
        <TextLine
          value={client.name || "Client name"}
          color={client.name ? tokens.ink : tokens.inkSubtle}
          size={11}
          weight={700}
        />
        <div style={{ marginTop: "3pt" }}>
          {hasClientAddress(invoice)
            ? addressLines(client.billingAddress).map((line) => (
                <TextLine key={line} value={line} color={tokens.inkMuted} size={8.2} />
              ))
            : null}
          {clientContact.map(([label, value]) => (
            <TextLine key={label} value={`${label} · ${value}`} color={tokens.inkMuted} size={8} />
          ))}
        </div>
        {showShip ? (
          <div style={{ marginTop: "6pt" }}>
            <div className="tracked-label" style={{ color: tokens.inkSubtle, fontSize: "6.8pt" }}>
              Ship to
            </div>
            {addressLines(shipTo).map((line) => (
              <TextLine key={line} value={line} color={tokens.inkMuted} size={8} />
            ))}
          </div>
        ) : null}
      </div>

      {/* ---------- Metadata ---------- */}
      <div style={{ minWidth: 0 }}>
        <SectionLabel color={tokens.inkSubtle}>Details</SectionLabel>
        {meta.map(([label, value]) => (
          <div key={label} style={{ marginBottom: "5pt" }}>
            <div className="tracked-label" style={{ color: tokens.inkSubtle, fontSize: "6.8pt" }}>
              {label}
            </div>
            <div style={{ color: tokens.ink, fontSize: "8.6pt", fontWeight: 500 }}>{value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function hasAddressContent(address: Address): boolean {
  return [address.line1, address.line2, address.city, address.state, address.pincode].some(
    (value) => !!value && value.trim() !== "",
  );
}
