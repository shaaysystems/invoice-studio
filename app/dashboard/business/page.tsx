// app/dashboard/business/page.tsx
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/supabase/server";
import { BusinessProfileClient } from "./BusinessProfileClient";

export const metadata: Metadata = { title: "Business profile", robots: { index: false, follow: false } };

export default async function BusinessProfilePage() {
  const user = await getCurrentUser();
  return <BusinessProfileClient authenticated={Boolean(user)} />;
}
