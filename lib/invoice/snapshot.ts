import type { Address, Invoice, InvoiceListRow } from "@/types/invoice";

export type InvoiceStatus = InvoiceListRow["status"];

export function cloneAddress(address: Address): Address {
  return { ...address };
}

/** Structured clone that keeps nested objects independent of the source. */
export function cloneInvoice(invoice: Invoice): Invoice {
  return {
    ...invoice,
    business: { ...invoice.business, address: cloneAddress(invoice.business.address), socials: { ...invoice.business.socials } },
    client: {
      ...invoice.client,
      billingAddress: cloneAddress(invoice.client.billingAddress),
      shippingAddress: cloneAddress(invoice.client.shippingAddress),
    },
    items: invoice.items.map((item) => ({ ...item })),
    payment: { ...invoice.payment, bank: { ...invoice.payment.bank }, qr: { ...invoice.payment.qr } },
    signature: { ...invoice.signature },
    brand: { ...invoice.brand },
  };
}

/**
 * Copies an invoice under a new identity. The original is never mutated, and
 * each nested object is cloned so later edits cannot bleed across.
 */
export function duplicateInvoice(
  source: Invoice,
  overrides: Partial<Invoice> = {},
): Invoice {
  const copy = cloneInvoice(source);
  return {
    ...copy,
    ...overrides,
    business: overrides.business ? { ...copy.business, ...overrides.business } : copy.business,
    client: overrides.client ? { ...copy.client, ...overrides.client } : copy.client,
    payment: overrides.payment ? { ...copy.payment, ...overrides.payment } : copy.payment,
    signature: overrides.signature ? { ...copy.signature, ...overrides.signature } : copy.signature,
    brand: overrides.brand ? { ...copy.brand, ...overrides.brand } : copy.brand,
    items: overrides.items ? overrides.items.map((item) => ({ ...item })) : copy.items,
  };
}

/** Projects a full invoice down to the row shape the dashboard list renders. */
export function toListRow(
  invoice: Invoice,
  grandTotalMinor: number,
  status: InvoiceStatus = "draft",
): InvoiceListRow {
  return {
    id: invoice.id,
    number: invoice.number,
    clientName: invoice.client.name,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    grandTotalMinor,
    status,
    updatedAt: invoice.updatedAt,
  };
}
