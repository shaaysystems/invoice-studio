import type { Metadata } from "next";
import { NewInvoiceClient } from "./NewInvoiceClient";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New invoice", robots: { index: false, follow: false } };

export default async function NewInvoicePage() {
  const user = await getCurrentUser();
  return <NewInvoiceClient authenticated={Boolean(user)} />;
}
