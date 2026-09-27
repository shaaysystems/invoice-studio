"use client";

import { useEffect, useMemo, useState } from "react";
import { InvoiceEditor } from "@/components/editor/InvoiceEditor";
import { AppShell } from "@/components/dashboard/AppShell";
import { createDemoInvoice, createEmptyInvoice, invoiceFromProfile } from "@/lib/invoice/defaults";
import { defaultPrefix, generateInvoiceNumber, numberingConfigFromProfile } from "@/lib/invoice/numbering";
import { localStore } from "@/lib/storage/local";
import { Button, Skeleton } from "@/components/ui";
import type { Invoice } from "@/types/invoice";

export function NewInvoiceClient({ authenticated }: { authenticated: boolean }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  const fallbackNumber = useMemo(
    () => generateInvoiceNumber({ prefix: defaultPrefix(), nextSequence: 1, padding: 3 }),
    [],
  );

  useEffect(() => {
    // Resume an unfinished draft, otherwise prefill from the saved profile.
    const draft = localStore.getDraft();
    if (draft) {
      setInvoice(draft);
      return;
    }
    const profile = localStore.getBusinessProfile();
    setInvoice(
      profile
        ? invoiceFromProfile(
            profile,
            generateInvoiceNumber(numberingConfigFromProfile(profile.numbering)),
          )
        : createEmptyInvoice({ number: fallbackNumber }),
    );
  }, [fallbackNumber]);

  if (!invoice) {
    return (
      <AppShell authenticated={authenticated}>
        <div className="space-y-3 p-6">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell authenticated={authenticated} bare>
      <div className="no-print flex items-center justify-end gap-2 border-b border-shell-200 bg-white px-4 py-2">
        <span className="mr-auto text-[11px] text-shell-500">
          Not sure where to start? Load clearly-marked demo content.
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={() => setInvoice({ ...createDemoInvoice() })}>
          Load demo invoice
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            localStore.saveDraft(null);
            setInvoice(createEmptyInvoice({ number: fallbackNumber }));
          }}
        >
          Start blank
        </Button>
      </div>
      <InvoiceEditor authenticated={authenticated} initialInvoice={invoice} />
    </AppShell>
  );
}
