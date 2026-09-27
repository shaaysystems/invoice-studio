// app/invoices/[id]/EditInvoiceClient.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/dashboard/AppShell";
import { InvoiceEditor } from "@/components/editor/InvoiceEditor";
import { localStore } from "@/lib/storage/local";
import { EmptyState, Skeleton } from "@/components/ui";
import type { InvoiceRecord } from "@/lib/actions/invoices";
import type { Invoice } from "@/types/invoice";

export function EditInvoiceClient({
  authenticated,
  invoiceId,
  cloudInvoice,
}: {
  authenticated: boolean;
  invoiceId: string;
  cloudInvoice: InvoiceRecord | null;
}) {
  const [invoice, setInvoice] = useState<Invoice | null | "missing">(cloudInvoice?.invoice ?? null);

  useEffect(() => {
    if (cloudInvoice) return;
    setInvoice(localStore.getInvoice(invoiceId)?.invoice ?? "missing");
  }, [cloudInvoice, invoiceId]);

  if (invoice === null) {
    return (
      <AppShell authenticated={authenticated}>
        <div className="space-y-3 p-6">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppShell>
    );
  }

  if (invoice === "missing") {
    return (
      <AppShell authenticated={authenticated}>
        <div className="p-6">
          <EmptyState
            title="We couldn't find that invoice"
            description="It may have been deleted, or it belongs to a different account or browser."
            action={
              <Link href="/invoices/new" className="rounded-lg bg-shell-900 px-4 py-2 text-sm font-medium text-white">
                Create an invoice
              </Link>
            }
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell authenticated={authenticated} bare>
      <InvoiceEditor authenticated={authenticated} initialInvoice={invoice} />
    </AppShell>
  );
}
