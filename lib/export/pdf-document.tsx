import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
/* eslint-disable jsx-a11y/alt-text -- react-pdf <Image> renders a PDF XObject, not a DOM <img> */
import type { ReactNode } from "react";
import type { Style, StyleProp } from "@react-pdf/types";
import { buildInvoiceTokens, type InvoiceTokens } from "@/lib/brand/tokens";
import { amountToWordsINR, formatINR, formatInvoiceDate, formatPercent, formatQuantity } from "@/lib/formatting/inr";
import { unscaleQuantity } from "@/lib/money";
import { PAGE, QR_SIZE } from "@/lib/invoice/layout-metrics";
import { paginateInvoiceItems } from "@/lib/invoice/paginate";
import {
  effectiveClientAddress,
  formatAddressLines,
  hasAnyPayment,
  hasBankDetails,
  hasBusinessAddress,
  hasClientAddress,
  hasPaymentQr,
  hasSignatureContent,
  partyLines,
  resolveLogoUrl,
  visibleSocialLinks,
} from "@/lib/invoice/presence";
import { resolvePaymentQr, type ResolvedPaymentQr } from "@/lib/payment/qr";
import type { Invoice, InvoiceTotals } from "@/types/invoice";
let fontState: "unknown" | "ready" | "fallback" = "unknown";

/**
 * Registers Inter so the ₹ glyph renders. If the fonts are unavailable we fall
 * back to Helvetica and print "Rs." instead of emitting missing-glyph boxes.
 */
export async function ensurePdfFonts(origin: string): Promise<boolean> {
  if (fontState !== "unknown") return fontState === "ready";
  try {
    const probe = await fetch(`${origin}/fonts/Inter-Regular.ttf`, { method: "HEAD" });
    if (!probe.ok) throw new Error("missing");

    Font.register({
      family: "Inter",
      fonts: [
        { src: `${origin}/fonts/Inter-Regular.ttf`, fontWeight: 400 },
        { src: `${origin}/fonts/Inter-Medium.ttf`, fontWeight: 500 },
        { src: `${origin}/fonts/Inter-SemiBold.ttf`, fontWeight: 600 },
        { src: `${origin}/fonts/Inter-Bold.ttf`, fontWeight: 700 },
      ],
    });
    Font.registerHyphenationCallback((word) => [word]); // no hyphen breaks in item names
    fontState = "ready";
    return true;
  } catch (err) {
    fontState = "fallback";
    // Surfaced because this is otherwise invisible: PDFs still export, they just
    // say "Rs." instead of "₹". If you see this, run `npm run fonts:install`.
    console.warn(
      `[pdf] Inter unavailable at ${origin}/fonts — falling back to Helvetica, amounts will print as "Rs." (${(err as Error).message})`,
    );
    return false;
  }
}

const styles = StyleSheet.create({
  page: {
    paddingTop: PAGE.padTop,
    paddingBottom: PAGE.padBottom,
    paddingHorizontal: PAGE.padX,
    fontSize: 9,
    flexDirection: "column",
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between" },
  label: { fontSize: 6.8, textTransform: "uppercase", letterSpacing: 0.6 },
});

interface PdfProps {
  invoice: Invoice;
  totals: InvoiceTotals;
  useInter: boolean;
}

export function InvoicePdfDocument({ invoice, totals, useInter }: PdfProps) {
  const tokens = buildInvoiceTokens(invoice.brand);
  const { pages, pageCount, metrics } = paginateInvoiceItems(invoice, totals);
  const family = useInter ? "Inter" : "Helvetica";
  const money = (minor: number) => formatINR(minor, { symbol: useInter ? "₹" : "Rs. " });
  const cols = metrics.table.columns;

  // Column cell: `width` is a plain number so callers pass the table metrics
  // straight through, while the remaining props are react-native view styles.
  const Cell = ({
    w,
    align = "left",
    children,
    textStyle,
    ...rest
  }: {
    w: number;
    align?: "left" | "right" | "center";
    children?: ReactNode;
    textStyle?: StyleProp;
  } & Omit<Style, "width" | "textAlign">) => (
    <View style={{ width: w, paddingHorizontal: 4, ...rest }}>
      <Text style={{ textAlign: align, fontFamily: family, ...(textStyle ?? {}) }}>{children}</Text>
    </View>
  );

  return (
    <Document
      title={`Invoice ${invoice.number}`}
      author={invoice.business.name}
      creator="Invoice Studio"
      producer="Invoice Studio"
    >
      {pages.map((page) => (
        <Page key={page.pageNumber} size="A4" style={{ ...styles.page, backgroundColor: tokens.pageBg, fontFamily: family }}>
          {invoice.brand.accentBarEnabled ? (
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                backgroundColor: tokens.accent,
              }}
              fixed
            />
          ) : null}

          {page.isFirst ? (
            <PdfHeader invoice={invoice} tokens={tokens} family={family} />
          ) : (
            <View
              style={{ ...styles.rowBetween, paddingBottom: 8, borderBottomWidth: 0.75, borderBottomColor: tokens.rule }}
            >
              <View>
                <Text style={{ fontSize: 9.5, fontWeight: 600, color: tokens.ink }}>
                  {invoice.business.name}
                </Text>
                <Text style={{ fontSize: 7.4, color: tokens.inkSubtle }}>
                  Invoice {invoice.number} — continued
                </Text>
              </View>
              <Text style={{ fontSize: 7.8, color: tokens.inkMuted }}>{invoice.client.name}</Text>
            </View>
          )}

          {page.isFirst ? <PdfParties invoice={invoice} tokens={tokens} /> : null}

          {page.showTable && page.rows.length > 0 ? (
            <View style={{ marginTop: 14 }}>
              {/* Header row, repeated per page by construction. */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  height: 21,
                  backgroundColor: tokens.tableHeadBg,
                  borderTopWidth: 1.2,
                  borderTopColor: tokens.ruleStrong,
                  borderBottomWidth: 0.75,
                  borderBottomColor: tokens.rule,
                }}
              >
                {[
                  ["#", cols.index, "left"],
                  ["Item description", cols.description, "left"],
                  ...(metrics.table.showHsn ? [["HSN/SAC", cols.hsn, "left"]] : []),
                  ["Qty", cols.qty, "right"],
                  ...(metrics.table.showUnit ? [["Unit", cols.unit, "left"]] : []),
                  ["Rate", cols.rate, "right"],
                  ...(metrics.table.showTaxColumn ? [["GST", cols.taxPct, "right"]] : []),
                  ["Amount", cols.amount, "right"],
                ].map(([label, width, align]) => (
                  <View key={String(label)} style={{ width: width as number, paddingHorizontal: 4 }}>
                    <Text
                      style={{
                        ...styles.label,
                        fontWeight: 600,
                        color: tokens.tableHeadInk,
                        textAlign: align as "left" | "right",
                      }}
                    >
                      {label as string}
                    </Text>
                  </View>
                ))}
              </View>

              {page.rows.map((row, index) => (
                <View
                  key={row.item.id}
                  wrap={false}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    paddingVertical: 7,
                    borderBottomWidth: 0.5,
                    borderBottomColor: tokens.rule,
                    backgroundColor: index % 2 === 1 ? tokens.rowAltBg : undefined,
                  }}
                >
                  <Cell w={cols.index} textStyle={{ fontSize: 7.6, color: tokens.inkSubtle }}>
                    {String(row.serial).padStart(2, "0")}
                  </Cell>
                  <View style={{ width: cols.description, paddingHorizontal: 4 }}>
                    <Text style={{ fontSize: 9.2, fontWeight: 600, color: tokens.ink, lineHeight: 1.3 }}>
                      {row.item.description || "Untitled item"}
                    </Text>
                  </View>
                  {metrics.table.showHsn ? (
                    <Cell w={cols.hsn} textStyle={{ fontSize: 8, color: tokens.inkMuted }}>{row.item.hsn}</Cell>
                  ) : null}
                  <Cell w={cols.qty} align="right" textStyle={{ fontSize: 8.8, color: tokens.ink }}>
                    {formatQuantity(unscaleQuantity(row.item.quantity))}
                  </Cell>
                  {metrics.table.showUnit ? (
                    <Cell w={cols.unit} textStyle={{ fontSize: 8, color: tokens.inkMuted }}>{row.item.unit}</Cell>
                  ) : null}
                  <Cell w={cols.rate} align="right" textStyle={{ fontSize: 8.8, color: tokens.ink }}>
                    {money(row.item.rateMinor)}
                  </Cell>
                  {metrics.table.showTaxColumn ? (
                    <Cell w={cols.taxPct} align="right" textStyle={{ fontSize: 8, color: tokens.inkMuted }}>
                      {formatPercent(row.item.taxRate)}
                    </Cell>
                  ) : null}
                  <Cell w={cols.amount} align="right" textStyle={{ fontSize: 9, fontWeight: 600, color: tokens.ink }}>
                    {money(row.line?.grossMinor ?? 0)}
                  </Cell>
                </View>
              ))}

              {page.continuesOnNext ? (
                <Text style={{ marginTop: 5, textAlign: "right", fontSize: 7.2, color: tokens.inkSubtle }}>
                  Continued on the next page
                </Text>
              ) : null}
            </View>
          ) : null}

          {page.showTail ? (
            <>
              <PdfTotals invoice={invoice} totals={totals} tokens={tokens} money={money} />
              <PdfPayment invoice={invoice} tokens={tokens} totals={totals} />
              <PdfSignature invoice={invoice} tokens={tokens} />
            </>
          ) : null}

          <View style={{ flexGrow: 1 }} />

          <View
            style={{
              ...styles.rowBetween,
              paddingTop: 9,
              borderTopWidth: 0.5,
              borderTopColor: tokens.rule,
            }}
          >
            <Text style={{ fontSize: 6.9, color: tokens.inkSubtle }}>{invoice.business.name}</Text>
            {pageCount > 1 ? (
              <Text style={{ fontSize: 6.9, color: tokens.inkSubtle }}>
                Page {page.pageNumber} of {pageCount}
              </Text>
            ) : (
              <Text />
            )}
          </View>
        </Page>
      ))}
    </Document>
  );
}

function PdfHeader({ invoice, tokens, family }: { invoice: Invoice; tokens: InvoiceTokens; family: string }) {
  const { business, brand, number, dueDate } = invoice;
  const logoUrl = resolveLogoUrl(invoice);
  const showLogo = brand.showLogo && !!logoUrl;
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
      <View style={{ flexShrink: 1, paddingRight: 20 }}>
        {showLogo ? (
          <Image src={logoUrl} style={{ maxWidth: 150, maxHeight: 44, objectFit: "contain" }} />
        ) : null}
        <View style={{ marginTop: showLogo ? 9 : 0 }}>
          <Text style={{ fontSize: showLogo ? 11.5 : 15, fontWeight: 700, color: tokens.ink, fontFamily: family }}>
            {business.name}
          </Text>
          {business.legalName && business.legalName !== business.name ? (
            <Text style={{ fontSize: 8.2, color: tokens.inkMuted }}>{business.legalName}</Text>
          ) : null}
        </View>
      </View>

      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ fontSize: 30, fontWeight: 700, color: tokens.titleColor, letterSpacing: -0.6 }}>Invoice</Text>
        {number ? (
          <View
            style={{
              marginTop: 7,
              paddingVertical: 3.5,
              paddingHorizontal: 9,
              borderRadius: 10,
              backgroundColor: tokens.numberPillBg,
            }}
          >
            <Text style={{ fontSize: 9, fontWeight: 600, color: tokens.numberPillInk }}>{number}</Text>
          </View>
        ) : null}
        {invoice.brand.accentBarEnabled ? (
          <View style={{ marginTop: 9, width: 52, height: 2, backgroundColor: tokens.accent }} />
        ) : null}
        {dueDate ? (
          <Text style={{ marginTop: 7, fontSize: 7.8, color: tokens.inkMuted }}>
            Payment due {formatInvoiceDate(dueDate)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function PdfParties({ invoice, tokens }: { invoice: Invoice; tokens: InvoiceTokens }) {
  const { business, client } = invoice;
  const isGst = invoice.taxMode === "gst";
  const addr = formatAddressLines;

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
  const showShip = !client.shipToSameAsBillTo && shipTo.line1.trim() !== "";

  const Label = ({ children }: { children: string }) => (
    <Text style={{ ...styles.label, fontWeight: 600, color: tokens.inkSubtle, marginBottom: 5 }}>{children}</Text>
  );

  return (
    <View
      style={{
        flexDirection: "row",
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 0.75,
        borderTopColor: tokens.rule,
      }}
    >
      <View style={{ width: "34%", paddingRight: 14 }}>
        <Label>From</Label>
        {hasBusinessAddress(invoice)
          ? addr(business.address).map((line) => (
              <Text key={line} style={{ fontSize: 8.2, color: tokens.inkMuted, lineHeight: 1.38 }}>
                {line}
              </Text>
            ))
          : null}
        {businessContact.map(([label, value]) => (
          <Text key={label} style={{ fontSize: 8, color: tokens.inkMuted, lineHeight: 1.38 }}>
            {label} · {value}
          </Text>
        ))}
        {socials.length ? (
          <Text style={{ marginTop: 3, fontSize: 7.6, color: tokens.inkSubtle }}>
            {socials.map((s) => `${s.label} ${s.value}`).join("  ·  ")}
          </Text>
        ) : null}
      </View>

      <View style={{ width: "38%", paddingRight: 14 }}>
        <Label>Bill to</Label>
        <Text style={{ fontSize: 11, fontWeight: 700, color: tokens.ink }}>{client.name}</Text>
        {hasClientAddress(invoice)
          ? addr(client.billingAddress).map((line) => (
              <Text key={line} style={{ fontSize: 8.2, color: tokens.inkMuted, lineHeight: 1.38 }}>
                {line}
              </Text>
            ))
          : null}
        {clientContact.map(([label, value]) => (
          <Text key={label} style={{ fontSize: 8, color: tokens.inkMuted, lineHeight: 1.38 }}>
            {label} · {value}
          </Text>
        ))}
        {showShip ? (
          <View style={{ marginTop: 6 }}>
            <Text style={{ ...styles.label, color: tokens.inkSubtle }}>Ship to</Text>
            {addr(shipTo).map((line) => (
              <Text key={line} style={{ fontSize: 8, color: tokens.inkMuted, lineHeight: 1.38 }}>
                {line}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      <View style={{ width: "28%" }}>
        <Label>Details</Label>
        {meta.map(([label, value]) => (
          <View key={label} style={{ marginBottom: 5 }}>
            <Text style={{ ...styles.label, color: tokens.inkSubtle }}>{label}</Text>
            <Text style={{ fontSize: 8.6, fontWeight: 500, color: tokens.ink }}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PdfTotals({
  invoice,
  totals,
  tokens,
  money,
}: {
  invoice: Invoice;
  totals: InvoiceTotals;
  tokens: InvoiceTokens;
  money: (m: number) => string;
}) {
  const isGst = invoice.taxMode === "gst";
  const isIntra = invoice.gstScope === "intra";
  const mixed = totals.buckets.length > 1;

  const Row = ({ label, value }: { label: string; value: string }) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.6 }}>
      <Text style={{ fontSize: 8.4, color: tokens.inkMuted }}>{label}</Text>
      <Text style={{ fontSize: 8.8, fontWeight: 500, color: tokens.ink }}>{value}</Text>
    </View>
  );

  return (
    <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 16 }}>
      <View style={{ width: 252 }}>
        <Row label="Subtotal" value={money(totals.subtotalMinor)} />
        {totals.lineDiscountMinor > 0 ? (
          <Row label="Item discount" value={`- ${money(totals.lineDiscountMinor)}`} />
        ) : null}
        {totals.globalDiscountMinor > 0 ? (
          <Row
            label={
              invoice.globalDiscountType === "percent"
                ? `Discount (${formatPercent(invoice.globalDiscountValue)})`
                : "Discount"
            }
            value={`- ${money(totals.globalDiscountMinor)}`}
          />
        ) : null}
        {isGst ? <Row label="Taxable value" value={money(totals.taxableMinor)} /> : null}
        {isGst
          ? totals.buckets.map((bucket) => {
              const suffix = mixed ? ` @ ${formatPercent(bucket.rate)}` : ` ${formatPercent(bucket.rate)}`;
              if (isIntra)
                return (
                  <View key={bucket.rate}>
                    <Row label={`CGST${suffix}`} value={money(bucket.cgstMinor)} />
                    <Row label={`SGST${suffix}`} value={money(bucket.sgstMinor)} />
                  </View>
                );
              return <Row key={bucket.rate} label={`IGST${suffix}`} value={money(bucket.igstMinor)} />;
            })
          : null}
        {totals.shippingMinor > 0 ? <Row label="Shipping" value={money(totals.shippingMinor)} /> : null}
        {totals.roundOffMinor !== 0 ? (
          <Row
            label="Round off"
            value={`${totals.roundOffMinor > 0 ? "+" : "-"} ${money(Math.abs(totals.roundOffMinor))}`}
          />
        ) : null}

        <View style={{ marginTop: 9, paddingVertical: 11, paddingHorizontal: 13, borderRadius: 4, backgroundColor: tokens.totalBg }}>
          <Text style={{ ...styles.label, fontWeight: 600, color: tokens.totalInk, opacity: 0.85 }}>
            Total due
          </Text>
          <Text style={{ fontSize: 22, fontWeight: 700, color: tokens.totalInk, marginTop: 2 }}>
            {money(totals.grandTotalMinor)}
          </Text>
        </View>

        {invoice.amountInWordsEnabled ? (
          <View style={{ marginTop: 7 }}>
            <Text style={{ ...styles.label, color: tokens.inkSubtle }}>In words</Text>
            <Text style={{ fontSize: 7.6, color: tokens.inkMuted, lineHeight: 1.4 }}>
              {amountToWordsINR(totals.grandTotalMinor)}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function PdfPayment({
  invoice,
  totals,
  tokens,
}: {
  invoice: Invoice;
  totals: Pick<InvoiceTotals, "grandTotalMinor">;
  tokens: InvoiceTokens;
}) {
  const showPayment = hasAnyPayment(invoice);
  const qr = hasPaymentQr(invoice) ? resolvePaymentQr(invoice, totals) : null;
  const terms = invoice.terms
    .split("\n")
    .map((t) => t.trim())
    .filter((t) => t !== "");
  const note = invoice.notes.trim();
  if (!showPayment && terms.length === 0 && !note) return null;

  const bank = partyLines([
    ["Account name", invoice.payment.bank.accountName],
    ["Bank", invoice.payment.bank.bankName],
    ["Account no.", invoice.payment.bank.accountNumber],
    ["IFSC", invoice.payment.bank.ifsc],
    ["Branch", invoice.payment.bank.branch],
  ]);

  return (
    <View
      style={{
        flexDirection: "row",
        marginTop: 18,
        paddingTop: 13,
        borderTopWidth: 0.75,
        borderTopColor: tokens.rule,
      }}
    >
      {showPayment ? (
        <View style={{ width: terms.length || note ? "50%" : "100%", paddingRight: 16, flexDirection: "row" }}>
          <View style={{ flexShrink: 1, flexGrow: 1 }}>
            <Text style={{ ...styles.label, fontWeight: 600, color: tokens.inkSubtle, marginBottom: 5 }}>
              Payment details
            </Text>
            <View style={{ flexDirection: "row" }}>
              <View style={{ flexShrink: 1, flexGrow: 1 }}>
                {hasBankDetails(invoice.payment)
                  ? bank.map(([label, value]) => (
                      <View key={label} style={{ flexDirection: "row", marginBottom: 1.6 }}>
                        <Text style={{ ...styles.label, width: 52, color: tokens.inkSubtle }}>{label}</Text>
                        <Text style={{ fontSize: 8.2, color: tokens.ink, flexShrink: 1 }}>{value}</Text>
                      </View>
                    ))
                  : null}
                {invoice.payment.upiId.trim() ? (
                  <View
                    style={{
                      marginTop: 6,
                      alignSelf: "flex-start",
                      paddingVertical: 3,
                      paddingHorizontal: 8,
                      borderRadius: 3,
                      backgroundColor: tokens.accentSoft,
                    }}
                  >
                    <Text style={{ fontSize: 8.2, fontWeight: 600, color: tokens.ink }}>
                      UPI · {invoice.payment.upiId}
                    </Text>
                  </View>
                ) : null}
              </View>
              {invoice.payment.paymentLink.trim() ? (
                <View style={{ marginTop: 6, alignSelf: "flex-start", maxWidth: "100%" }}>
                  <Text style={{ ...styles.label, color: tokens.inkSubtle }}>Pay online</Text>
                  <Text style={{ fontSize: 8.2, color: tokens.ink, flexShrink: 1 }}>{invoice.payment.paymentLink}</Text>
                </View>
              ) : null}
              {invoice.payment.paymentNote.trim() ? (
                <View style={{ marginTop: 6, alignSelf: "flex-start", maxWidth: "100%" }}>
                  <Text style={{ ...styles.label, color: tokens.inkSubtle }}>Note</Text>
                  <Text style={{ fontSize: 8, color: tokens.inkMuted, flexShrink: 1 }}>{invoice.payment.paymentNote}</Text>
                </View>
              ) : null}
            </View>
          </View>
          {qr ? <PdfPaymentQr qr={qr} tokens={tokens} /> : null}
        </View>
      ) : null}

      {terms.length || note ? (
        <View style={{ width: showPayment ? "50%" : "100%" }}>
          {terms.length ? (
            <>
              <Text style={{ ...styles.label, fontWeight: 600, color: tokens.inkSubtle, marginBottom: 5 }}>
                Terms &amp; conditions
              </Text>
              {terms.map((term, index) => (
                <View key={index} style={{ flexDirection: "row", marginBottom: 2 }}>
                  <Text style={{ fontSize: 7.9, color: tokens.inkMuted, width: 10 }}>{index + 1}.</Text>
                  <Text style={{ fontSize: 7.9, color: tokens.inkMuted, lineHeight: 1.45, flexShrink: 1 }}>{term}</Text>
                </View>
              ))}
            </>
          ) : null}
          {note ? (
            <Text style={{ marginTop: terms.length ? 9 : 0, fontSize: 8.4, fontWeight: 500, color: tokens.ink }}>
              {note}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function PdfPaymentQr({ qr, tokens }: { qr: ResolvedPaymentQr; tokens: InvoiceTokens }) {
  return (
    <View style={{ width: QR_SIZE + 12, alignItems: "center", marginLeft: 12 }}>
      <Image
        src={qr.src}
        style={{
          width: QR_SIZE,
          height: QR_SIZE,
          objectFit: "contain",
          // A white plate keeps the code readable on a tinted brand surface.
          backgroundColor: "#ffffff",
          padding: 3,
          borderWidth: 0.5,
          borderColor: tokens.rule,
          borderRadius: 3,
        }}
      />
      {qr.label ? (
        <Text style={{ marginTop: 4, fontSize: 7.4, fontWeight: 600, color: tokens.ink }}>{qr.label}</Text>
      ) : null}
      {qr.amountText ? (
        <Text style={{ marginTop: 1, fontSize: 7.6, color: tokens.inkMuted }}>{qr.amountText}</Text>
      ) : null}
    </View>
  );
}

function PdfSignature({ invoice, tokens }: { invoice: Invoice; tokens: InvoiceTokens }) {
  if (!hasSignatureContent(invoice.signature)) return null;
  const { signature } = invoice;
  return (
    <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 18 }}>
      <View style={{ minWidth: 132, alignItems: "flex-end" }}>
        {signature.imageUrl ? (
          <Image src={signature.imageUrl} style={{ maxWidth: 124, maxHeight: 34, objectFit: "contain" }} />
        ) : (
          <View style={{ height: 24 }} />
        )}
        <View
          style={{
            marginTop: 3,
            paddingTop: 4,
            borderTopWidth: 0.75,
            borderTopColor: tokens.ruleStrong,
            minWidth: 132,
            alignItems: "flex-end",
          }}
        >
          {signature.name ? (
            <Text style={{ fontSize: 8.8, fontWeight: 600, color: tokens.ink }}>{signature.name}</Text>
          ) : null}
          {signature.designation ? (
            <Text style={{ fontSize: 7.8, color: tokens.inkMuted }}>{signature.designation}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
