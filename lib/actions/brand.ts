"use server";

import { revalidatePath } from "next/cache";
import { brandSchema } from "@/lib/validation/invoice-schema";
import { createServerSupabase, requireUser } from "@/lib/supabase/server";
import type { ActionResult } from "./invoices";
import type { BrandProfile } from "@/types/brand";

interface BrandRow {
  id: string;
  business_profile_id: string | null;
  payload: Omit<BrandProfile, "id" | "businessProfileId" | "createdAt" | "updatedAt">;
  created_at: string;
  updated_at: string;
}

function rowToProfile(row: BrandRow): BrandProfile {
  return {
    ...row.payload,
    id: row.id,
    businessProfileId: row.business_profile_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The saved brand kit. A profile owns exactly one; invoices snapshot it. */
export async function fetchBrandProfileAction(
  businessProfileId: string,
): Promise<ActionResult<BrandProfile | null>> {
  try {
    const user = await requireUser();
    const supabase = await createServerSupabase();
    if (!supabase) return { ok: false, error: "Cloud saving is not available." };

    const { data, error } = await supabase
      .from("brand_profiles")
      .select("id, business_profile_id, payload, created_at, updated_at")
      .eq("user_id", user.id)
      .eq("business_profile_id", businessProfileId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: true, data: null };

    return { ok: true, data: rowToProfile(data as unknown as BrandRow) };
  } catch (error) {
    if ((error as Error).message === "UNAUTHENTICATED") return { ok: true, data: null };
    console.error("[fetchBrandProfile]", (error as Error).message);
    return { ok: false, error: "We couldn't load your brand settings." };
  }
}

export async function saveBrandProfileAction(
  profile: BrandProfile,
): Promise<ActionResult<{ id: string }>> {
  try {
    // `updatedAt` is server-owned, so it is stripped before validation.
    const { id, businessProfileId, createdAt, updatedAt: _updatedAt, ...brand } = profile;
    const payload = brandSchema.parse(brand);
    const user = await requireUser();
    const supabase = await createServerSupabase();
    if (!supabase) return { ok: false, error: "Cloud saving is not available." };

    const now = new Date().toISOString();
    const { error } = await supabase.from("brand_profiles").upsert(
      {
        id,
        user_id: user.id,
        business_profile_id: businessProfileId,
        schema_version: 1,
        payload,
        created_at: createdAt,
        updated_at: now,
      },
      { onConflict: "id" },
    );
    if (error) throw error;

    revalidatePath("/dashboard/brand");
    return { ok: true, data: { id } };
  } catch (error) {
    if ((error as Error).message === "UNAUTHENTICATED") {
      return { ok: false, error: "Your session expired. Sign in again to save to the cloud." };
    }
    console.error("[saveBrandProfile]", (error as Error).message);
    return { ok: false, error: "We couldn't save your brand settings." };
  }
}
