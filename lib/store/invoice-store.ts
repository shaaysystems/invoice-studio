"use client";

import { create } from "zustand";
import { calculateInvoiceTotals } from "@/lib/invoice/calculate";
import { createEmptyInvoice, createEmptyItem, newId } from "@/lib/invoice/defaults";
import { paginateInvoiceItems, type PaginationResult } from "@/lib/invoice/paginate";
import { localStore } from "@/lib/storage/local";
import type {
  Address,
  ClientParty,
  BusinessParty,
  Invoice,
  InvoiceBrand,
  InvoiceItem,
  InvoiceTotals,
  PaymentDetails,
  PaymentQr,
  SignatureBlock,
  SocialLinks,
} from "@/types/invoice";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

/** Editor panels, matching the Parties / Details / Items / Payment / Brand tabs. */
export type EditorSection = "parties" | "details" | "items" | "payment" | "brand";

interface InvoiceStoreState {
  invoice: Invoice;
  saveState: SaveState;
  lastSavedAt: string | null;
  activeSection: EditorSection;
  cloudEnabled: boolean;

  /* selectors (recomputed, memoised by reference below) */
  totals: () => InvoiceTotals;
  pagination: () => PaginationResult;

  /* mutations */
  load: (invoice: Invoice) => void;
  reset: () => void;
  patch: (patch: Partial<Invoice>) => void;

  patchBusiness: (patch: Partial<BusinessParty>) => void;
  patchBusinessAddress: (patch: Partial<Address>) => void;
  patchBusinessSocial: (patch: Partial<SocialLinks>) => void;

  patchClient: (patch: Partial<ClientParty>) => void;
  patchClientAddress: (patch: Partial<Address>) => void;
  patchClientShippingAddress: (patch: Partial<Address>) => void;

  patchDetails: (patch: Partial<Invoice>) => void;
  patchTax: (
    patch: Partial<Pick<Invoice, "taxMode" | "gstScope" | "pricesIncludeTax">>,
  ) => void;
  patchAdjustments: (
    patch: Partial<
      Pick<
        Invoice,
        | "globalDiscountType"
        | "globalDiscountValue"
        | "shippingMinor"
        | "roundOffEnabled"
        | "amountInWordsEnabled"
      >
    >,
  ) => void;

  patchPayment: (patch: Partial<PaymentDetails>) => void;
  patchBank: (patch: Partial<PaymentDetails["bank"]>) => void;
  patchPaymentQr: (patch: Partial<PaymentQr>) => void;
  patchSignature: (patch: Partial<SignatureBlock>) => void;
  patchLogoOverride: (url: string) => void;
  patchBrand: (patch: Partial<InvoiceBrand>) => void;

  addItem: () => void;
  updateItem: (id: string, patch: Partial<InvoiceItem>) => void;
  removeItem: (id: string) => void;
  duplicateItem: (id: string) => void;
  moveItem: (id: string, direction: -1 | 1) => void;

  setTerms: (text: string) => void;
  setNotes: (text: string) => void;

  setSaveState: (state: SaveState) => void;
  setActiveSection: (section: EditorSection) => void;
  setCloudEnabled: (enabled: boolean) => void;
  persistLocalDraft: () => void;
}

// --- Derived-value cache: totals/pagination are pure, so memoise by invoice ref.
let cacheKey: Invoice | null = null;
let cachedTotals: InvoiceTotals | null = null;
let cachedPagination: PaginationResult | null = null;

function derive(invoice: Invoice) {
  if (cacheKey !== invoice || !cachedTotals || !cachedPagination) {
    cacheKey = invoice;
    cachedTotals = calculateInvoiceTotals(invoice);
    cachedPagination = paginateInvoiceItems(invoice, cachedTotals);
  }
  return { totals: cachedTotals, pagination: cachedPagination };
}

export const useInvoiceStore = create<InvoiceStoreState>((set, get) => {
  const mutate = (updater: (invoice: Invoice) => Invoice) =>
    set((state) => ({
      invoice: { ...updater(state.invoice), updatedAt: new Date().toISOString() },
      saveState: "dirty" as const,
    }));

  return {
    invoice: createEmptyInvoice(),
    saveState: "idle",
    lastSavedAt: null,
    activeSection: "parties",
    cloudEnabled: false,

    totals: () => derive(get().invoice).totals,
    pagination: () => derive(get().invoice).pagination,

    load: (invoice) => set({ invoice, saveState: "idle", lastSavedAt: invoice.updatedAt }),
    reset: () => set({ invoice: createEmptyInvoice(), saveState: "idle", lastSavedAt: null }),

    patch: (patch) => mutate((inv) => ({ ...inv, ...patch })),

    patchBusiness: (patch) =>
      mutate((inv) => ({ ...inv, business: { ...inv.business, ...patch } })),
    patchBusinessAddress: (patch) =>
      mutate((inv) => ({
        ...inv,
        business: { ...inv.business, address: { ...inv.business.address, ...patch } },
      })),
    patchBusinessSocial: (patch) =>
      mutate((inv) => ({
        ...inv,
        business: { ...inv.business, socials: { ...inv.business.socials, ...patch } },
      })),

    patchClient: (patch) => mutate((inv) => ({ ...inv, client: { ...inv.client, ...patch } })),
    patchClientAddress: (patch) =>
      mutate((inv) => ({
        ...inv,
        client: { ...inv.client, billingAddress: { ...inv.client.billingAddress, ...patch } },
      })),
    patchClientShippingAddress: (patch) =>
      mutate((inv) => ({
        ...inv,
        client: { ...inv.client, shippingAddress: { ...inv.client.shippingAddress, ...patch } },
      })),

    patchDetails: (patch) => mutate((inv) => ({ ...inv, ...patch })),
    patchTax: (patch) => mutate((inv) => ({ ...inv, ...patch })),
    patchAdjustments: (patch) => mutate((inv) => ({ ...inv, ...patch })),

    patchPayment: (patch) =>
      mutate((inv) => ({ ...inv, payment: { ...inv.payment, ...patch } })),
    patchBank: (patch) =>
      mutate((inv) => ({ ...inv, payment: { ...inv.payment, bank: { ...inv.payment.bank, ...patch } } })),
    patchPaymentQr: (patch) =>
      mutate((inv) => ({ ...inv, payment: { ...inv.payment, qr: { ...inv.payment.qr, ...patch } } })),
    patchSignature: (patch) =>
      mutate((inv) => ({ ...inv, signature: { ...inv.signature, ...patch } })),
    patchLogoOverride: (url) => mutate((inv) => ({ ...inv, logoOverrideUrl: url })),
    patchBrand: (patch) => mutate((inv) => ({ ...inv, brand: { ...inv.brand, ...patch } })),

    addItem: () =>
      mutate((inv) => {
        // New rows inherit the last row's rate so a uniform invoice stays uniform.
        const last = inv.items[inv.items.length - 1];
        return { ...inv, items: [...inv.items, createEmptyItem({ taxRate: last?.taxRate ?? 18 })] };
      }),
    updateItem: (id, patch) =>
      mutate((inv) => ({
        ...inv,
        items: inv.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      })),
    removeItem: (id) =>
      mutate((inv) => {
        const remaining = inv.items.filter((item) => item.id !== id);
        // Always keep one row so the editor never shows an empty table.
        return { ...inv, items: remaining.length ? remaining : [createEmptyItem()] };
      }),
    duplicateItem: (id) =>
      mutate((inv) => {
        const index = inv.items.findIndex((item) => item.id === id);
        if (index < 0) return inv;
        const source = inv.items[index] as InvoiceItem;
        const copy = { ...source, id: newId() };
        const items = [...inv.items];
        items.splice(index + 1, 0, copy);
        return { ...inv, items };
      }),
    moveItem: (id, direction) =>
      mutate((inv) => {
        const index = inv.items.findIndex((item) => item.id === id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= inv.items.length) return inv;
        const items = [...inv.items];
        const [moved] = items.splice(index, 1);
        items.splice(target, 0, moved as InvoiceItem);
        return { ...inv, items };
      }),

    setTerms: (text) => mutate((inv) => ({ ...inv, terms: text })),
    setNotes: (text) => mutate((inv) => ({ ...inv, notes: text })),

    setSaveState: (saveState) =>
      set(saveState === "saved" ? { saveState, lastSavedAt: new Date().toISOString() } : { saveState }),
    setActiveSection: (activeSection) => set({ activeSection }),
    setCloudEnabled: (cloudEnabled) => set({ cloudEnabled }),
    persistLocalDraft: () => {
      localStore.saveDraft(get().invoice);
    },
  };
});

/** Stable selectors — components subscribe to the slice they actually use. */
export const selectInvoice = (s: InvoiceStoreState) => s.invoice;
export const selectBusiness = (s: InvoiceStoreState) => s.invoice.business;
export const selectClient = (s: InvoiceStoreState) => s.invoice.client;
export const selectItems = (s: InvoiceStoreState) => s.invoice.items;
export const selectBrand = (s: InvoiceStoreState) => s.invoice.brand;
