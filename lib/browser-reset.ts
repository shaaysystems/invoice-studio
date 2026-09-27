// lib/browser-reset.ts

/**
 * Every Invoice Studio key in localStorage. Guest invoices, the draft, the
 * business profile and the brand kit all live here; cloud data is untouched.
 */
const KEYS = [
  "invoice-studio:invoices:v2",
  "invoice-studio:draft:v2",
  "invoice-studio:business:v2",
  "invoice-studio:brand:v2",
] as const;

export const localStorageKeys = KEYS;

export function clearLocalData(): boolean {
  if (typeof window === "undefined") return false;
  try {
    for (const key of KEYS) window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
