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

/** v2 keys: the persisted shape changed incompatibly, so v1 data is ignored.
 *  `business` holds a `{ profiles, activeId }` envelope since multiple
 *  profiles became supported; `businessActive` keeps the choice discoverable. */
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

interface StoredProfiles {
  profiles: BusinessProfile[];
  activeId: string | null;
}

/**
 * Normalises the stored list. The first generation of this key held a single
 * bare `BusinessProfile`, so that shape is lifted into a one-item list rather
 * than discarded — upgrading must not delete a guest's saved details.
 */
function readProfiles(): StoredProfiles {
  const raw = read<unknown>(KEYS.business, null);
  if (!raw || typeof raw !== "object") return { profiles: [], activeId: null };

  const asList = raw as Partial<StoredProfiles>;
  if ("profiles" in asList) {
    // The envelope shape but corrupt: reject it outright rather than letting
    // `normalizeBusinessProfile` below resurrect the wrapper as a blank profile.
    if (!Array.isArray(asList.profiles)) return { profiles: [], activeId: null };
    const profiles = asList.profiles
      .map((entry) => normalizeBusinessProfile(entry))
      .filter((entry): entry is BusinessProfile => entry !== null);
    const activeId =
      typeof asList.activeId === "string" && profiles.some((p) => p.id === asList.activeId)
        ? asList.activeId
        : (profiles[0]?.id ?? null);
    return { profiles, activeId };
  }

  const single = normalizeBusinessProfile(raw);
  return single ? { profiles: [single], activeId: single.id } : { profiles: [], activeId: null };
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

  /** Every saved profile, in insertion order (oldest first). */
  listBusinessProfiles(): BusinessProfile[] {
    return readProfiles().profiles;
  },

  /**
   * The profile new invoices prefill from: the flagged default, else the first
   * saved. `setActiveBusinessProfile` is what the "active" choice means — a
   * guest has no server-side `is_default` to lean on.
   */
  getBusinessProfile(): BusinessProfile | null {
    const { profiles, activeId } = readProfiles();
    if (profiles.length === 0) return null;
    return profiles.find((profile) => profile.id === activeId) ?? profiles[0]!;
  },

  getBusinessProfileById(id: string): BusinessProfile | null {
    return readProfiles().profiles.find((profile) => profile.id === id) ?? null;
  },

  /** Inserts or replaces one profile, leaving the rest of the list alone. */
  saveBusinessProfile(profile: BusinessProfile): boolean {
    const { profiles, activeId } = readProfiles();
    const index = profiles.findIndex((entry) => entry.id === profile.id);
    if (index >= 0) profiles[index] = profile;
    else profiles.push(profile);
    return write(KEYS.business, { profiles, activeId: activeId ?? profile.id });
  },

  setActiveBusinessProfile(id: string): boolean {
    const { profiles } = readProfiles();
    if (!profiles.some((profile) => profile.id === id)) return false;
    return write(KEYS.business, { profiles, activeId: id });
  },

  /**
   * Overwrites the whole list with the account's copy. Used after a cloud read:
   * the account is the source of truth for a signed-in user, so guest-only
   * entries must not linger and reappear as phantom pickers.
   */
  replaceBusinessProfiles(profiles: BusinessProfile[], activeId: string | null): boolean {
    return write(KEYS.business, { profiles, activeId });
  },

  deleteBusinessProfile(id: string): void {
    const { profiles, activeId } = readProfiles();
    const remaining = profiles.filter((profile) => profile.id !== id);
    write(KEYS.business, {
      profiles: remaining,
      activeId: activeId === id ? (remaining[0]?.id ?? null) : activeId,
    });
  },

  getBrand(): InvoiceBrand | null {
    return read<InvoiceBrand | null>(KEYS.brand, null);
  },

  saveBrand(brand: InvoiceBrand): boolean {
    return write(KEYS.brand, brand);
  },
};
