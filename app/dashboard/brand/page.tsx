// app/dashboard/brand/page.tsx
import type { Metadata } from "next";
import { fetchBusinessProfileAction } from "@/lib/actions/business";
import { getCurrentUser } from "@/lib/supabase/server";
import { BrandClient } from "./BrandClient";

export const metadata: Metadata = {
  title: "Brand",
  robots: { index: false, follow: false },
};

export default async function BrandPage() {
  const user = await getCurrentUser();
  // A brand kit is attached to a business profile; guests keep theirs locally.
  const profile = user ? await fetchBusinessProfileAction() : null;
  return (
    <BrandClient
      authenticated={Boolean(user)}
      businessProfileId={profile?.ok ? (profile.data?.id ?? null) : null}
    />
  );
}
