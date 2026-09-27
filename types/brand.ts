import type { InvoiceBrand } from "./invoice";

/**
 * Persisted brand settings row. The new schema has no templates: a business
 * profile owns exactly one `InvoiceBrand`, and each invoice snapshots it.
 */
export interface BrandProfile extends InvoiceBrand {
  id: string;
  businessProfileId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Projects the editable fields of an invoice's brand into a brand row. */
export function brandProfileFromInvoiceBrand(
  brand: InvoiceBrand,
  meta: Pick<BrandProfile, "id" | "businessProfileId" | "createdAt" | "updatedAt">,
): BrandProfile {
  return { ...brand, ...meta };
}
