"use server";

import { revalidatePath } from "next/cache";
import { normalizeBusinessProfile } from "@/lib/invoice/normalize";
import { rollNumberingIfYearChanged } from "@/lib/invoice/numbering";
import { createServerSupabase, requireUser } from "@/lib/supabase/server";
import { businessProfileSchema } from "@/lib/validation/invoice-schema";
import type { ActionResult } from "./invoices";
import type { BusinessProfile } from "@/types/business";

/**
 * The business profile is a single row per user. The whole document lives in
 * `payload` (JSONB); denormalized columns exist only so the invoice list can
 * sort and search without a JSONB scan.
 */
export async function fetchBusinessProfileAction(): Promise<ActionResult<BusinessProfile | null>> {
  try {
    const user = await requireUser();
    const supabase = await createServerSupabase();
    if (!supabase) return { ok: false, error: "Cloud saving is not available." };

    const { data, error } = await supabase
      .from("business_profiles")
      .select("id, payload, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: true, data: null };

    const profile = normalizeBusinessProfile((data as { payload: unknown }).payload);
    if (!profile) return { ok: true, data: null };
    return {
      ok: true,
      // The row id is authoritative; the payload copy can drift on older writes.
      data: { ...profile, id: (data as { id: string }).id, userId: user.id },
    };
  } catch (error) {
    if ((error as Error).message === "UNAUTHENTICATED") return { ok: true, data: null };
    console.error("[fetchBusinessProfile]", (error as Error).message);
    return { ok: false, error: "We couldn't load your business profile." };
  }
}

export async function saveBusinessProfileAction(
  profile: BusinessProfile,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = businessProfileSchema.parse(profile);
    const user = await requireUser();
    const supabase = await createServerSupabase();
    if (!supabase) return { ok: false, error: "Cloud saving is not available." };

    // A financial-year rollover resets the sequence before it is persisted.
    const { numbering } = rollNumberingIfYearChanged(parsed.numbering);

    const now = new Date().toISOString();
    const payload: BusinessProfile = { ...parsed, numbering, updatedAt: now };

    const { error } = await supabase.from("business_profiles").upsert(
      {
        id: payload.id,
        user_id: user.id,
        display_name: payload.party.name || "My business",
        payload,
        updated_at: now,
      },
      { onConflict: "id" },
    );
    if (error) throw error;

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/business");
    return { ok: true, data: { id: payload.id } };
  } catch (error) {
    if ((error as Error).message === "UNAUTHENTICATED") {
      return { ok: false, error: "Your session expired. Sign in again to save to the cloud." };
    }
    // Profile payloads contain bank details — never log the body.
    console.error("[saveBusinessProfile]", (error as Error).message);
    return { ok: false, error: "We couldn't save your business profile." };
  }
}
