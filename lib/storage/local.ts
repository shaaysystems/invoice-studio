"use client";

import { normalizeBusinessProfile, normalizeInvoice } from "@/lib/invoice/normalize";
import type { Invoice, InvoiceBrand, InvoiceListRow } from "@/types/invoice";
import type { BusinessProfile } from "@/types/business";

/**
 * Status is not part of `Invoice` in the current schema, so it is stored
 * alongside the document in this envelope rather than inside it.
 */
export interface StoredInvoice {
  invoice: Invoice;
  status: InvoiceListRow["status"];
  savedAt: string;
}

/** v2 keys: the persisted shape changed incompatibly, so v1 data is ignored. */
const KEYS = {
  invoices: "invoice-studio:invoices:v2",
  draft: "invoice-studio:draft:v2",
  business: "invoice-studio:business:v2",
  brand: "invoice-studio:brand:v2",
} as const;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Most likely a quota error from large data-URL assets.
    return false;
  }
}

/**
 * Rebuilds a stored entry, skipping corrupt ones. Documents written by an
 * earlier version are missing newer fields, so normalising here means no
 * consumer ever has to cope with a partial document.
 */
function toStoredInvoice(value: unknown): StoredInvoice | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<StoredInvoice>;
  if (typeof candidate.savedAt !== "string") return null;
  const invoice = normalizeInvoice(candidate.invoice);
  if (!invoice || invoice.id === "") return null;
  const status = candidate.status;
  return {
    invoice,
    status: status === "sent" || status === "paid" ? status : "draft",
    savedAt: candidate.savedAt,
  };
}

function readInvoices(): StoredInvoice[] {
  const raw = read<unknown[]>(KEYS.invoices, []);
  if (!Array.isArray(raw)) return [];
  return raw.map(toStoredInvoice).filter((entry): entry is StoredInvoice => entry !== null);
}

export const localStore = {
  listInvoices(): StoredInvoice[] {
    return readInvoices().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  },

  getInvoice(id: string): StoredInvoice | null {
    return readInvoices().find((entry) => entry.invoice.id === id) ?? null;
  },

  /** Returns false when localStorage rejected the write (quota or private mode). */
  saveInvoice(invoice: Invoice, status: InvoiceListRow["status"] = "draft"): boolean {
    const all = readInvoices();
    const index = all.findIndex((entry) => entry.invoice.id === invoice.id);
    const record: StoredInvoice = { invoice, status, savedAt: new Date().toISOString() };
    if (index >= 0) all[index] = record;
    else all.push(record);
    return write(KEYS.invoices, all);
  },

  deleteInvoice(id: string): void {
    write(KEYS.invoices, readInvoices().filter((entry) => entry.invoice.id !== id));
  },

  getDraft(): Invoice | null {
    return normalizeInvoice(read<unknown>(KEYS.draft, null));
  },

  saveDraft(invoice: Invoice | null): boolean {
    return write(KEYS.draft, invoice);
  },

  getBusinessProfile(): BusinessProfile | null {
    return normalizeBusinessProfile(read<unknown>(KEYS.business, null));
  },

  saveBusinessProfile(profile: BusinessProfile): boolean {
    return write(KEYS.business, profile);
  },

  getBrand(): InvoiceBrand | null {
    return read<InvoiceBrand | null>(KEYS.brand, null);
  },

  saveBrand(brand: InvoiceBrand): boolean {
    return write(KEYS.brand, brand);
  },
};
