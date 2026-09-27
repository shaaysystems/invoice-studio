import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchInvoicesAction } from "@/lib/actions/invoices";
import { DashboardClient } from "../DashboardClient";

export const metadata: Metadata = { title: "Invoices", robots: { index: false, follow: false } };

export default async function InvoicesPage() {
  const user = await getCurrentUser();
  const cloud = user ? await fetchInvoicesAction() : null;
  return <DashboardClient authenticated={Boolean(user)} cloudInvoices={cloud?.data ?? []} />;
}
