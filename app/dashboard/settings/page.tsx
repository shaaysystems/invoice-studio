// app/dashboard/settings/page.tsx
import type { Metadata } from "next";
import { fetchInvoicesAction } from "@/lib/actions/invoices";
import { getCurrentUser } from "@/lib/supabase/server";
import { SettingsClient } from "./SettingsClient";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const invoices = user ? await fetchInvoicesAction() : null;

  // Read the user straight off the session. Going through a "use server"
  // export for data this page already has pulls the whole Supabase browser
  // client (GoTrue + realtime, ~240kB) into this route's client bundle.
  return (
    <SettingsClient
      authenticated={Boolean(user)}
      email={user?.email ?? null}
      memberSince={user?.created_at ?? null}
      invoiceCount={invoices?.data?.length ?? 0}
    />
  );
}
