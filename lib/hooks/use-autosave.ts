"use client";

import { useEffect, useRef } from "react";
import { saveInvoiceAction } from "@/lib/actions/invoices";
import { localStore } from "@/lib/storage/local";
import { useInvoiceStore } from "@/lib/store/invoice-store";

/** Draft persistence window. The editor contract requires a reload within
 *  600 ms of the last keystroke to restore the draft, so this must stay <= 600. */
const DEBOUNCE_MS = 600;

/**
 * Debounced autosave. Local drafts always persist; cloud saves are attempted
 * only for signed-in users and never block typing.
 */
export function useAutosave(enabled: boolean) {
  const invoice = useInvoiceStore((s) => s.invoice);
  const saveState = useInvoiceStore((s) => s.saveState);
  const setSaveState = useInvoiceStore((s) => s.setSaveState);
  const cloudEnabled = useInvoiceStore((s) => s.cloudEnabled);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || saveState !== "dirty") return;
    if (timer.current) clearTimeout(timer.current);

    timer.current = setTimeout(async () => {
      setSaveState("saving");
      const storedLocally = localStore.saveDraft(invoice);

      if (!cloudEnabled) {
        setSaveState(storedLocally ? "saved" : "error");
        return;
      }

      const result = await saveInvoiceAction(invoice);
      // Validation failures are expected mid-typing — keep the draft dirty, not errored.
      setSaveState(result.ok ? "saved" : result.issues?.length ? "dirty" : "error");
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, invoice, saveState, cloudEnabled, setSaveState]);
}
