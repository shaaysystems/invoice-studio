// app/dashboard/business/page.tsx
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/supabase/server";
import { BusinessProfileList } from "./BusinessProfileList";

export const metadata: Metadata = { title: "Business profiles", robots: { index: false, follow: false } };

export default async function BusinessProfilePage() {
  const user = await getCurrentUser();
  return <BusinessProfileList authenticated={Boolean(user)} />;
}
