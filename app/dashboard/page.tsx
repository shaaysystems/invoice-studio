// app/dashboard/page.tsx
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchInvoicesAction } from "@/lib/actions/invoices";
import { DashboardClient } from "./DashboardClient";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const cloud = user ? await fetchInvoicesAction() : null;
  return <DashboardClient authenticated={Boolean(user)} cloudInvoices={cloud?.data ?? []} />;
}
