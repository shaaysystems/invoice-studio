// app/invoices/[id]/page.tsx
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchInvoiceAction } from "@/lib/actions/invoices";
import { EditInvoiceClient } from "./EditInvoiceClient";

export const metadata: Metadata = { title: "Edit invoice", robots: { index: false, follow: false } };

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const cloud = user ? await fetchInvoiceAction(id) : null;

  return (
    <EditInvoiceClient
      authenticated={Boolean(user)}
      invoiceId={id}
      cloudInvoice={cloud?.ok ? cloud.data ?? null : null}
    />
  );
}
