"use server";

import { revalidatePath } from "next/cache";
import { normalizeBusinessProfile } from "@/lib/invoice/normalize";
import { rollNumberingIfYearChanged } from "@/lib/invoice/numbering";
import { createServerSupabase, requireUser } from "@/lib/supabase/server";
import { businessProfileSchema } from "@/lib/validation/invoice-schema";
import type { ActionResult } from "./invoices";
import type { BusinessProfile } from "@/types/business";

interface ProfileRow {
  id: string;
  payload: unknown;
  is_default: boolean;
  updated_at: string;
}

function rowToProfile(row: ProfileRow, userId: string): BusinessProfile | null {
  const profile = normalizeBusinessProfile(row.payload);
  if (!profile) return null;
  // The row id and flag are authoritative; the payload copy can drift on older writes.
  return { ...profile, id: row.id, userId };
}

/** One profile for a picker entry — enough to label a row without the payload. */
export interface BusinessProfileSummary {
  id: string;
  name: string;
  gstin: string;
  city: string;
  isDefault: boolean;
  updatedAt: string;
}

function toSummary(profile: BusinessProfile, isDefault: boolean, updatedAt: string): BusinessProfileSummary {
  return {
    id: profile.id,
    name: profile.party.name.trim() || "Untitled business",
    gstin: profile.party.gstin,
    city: profile.party.address.city,
    isDefault,
    updatedAt,
  };
}

/**
 * Every profile owned by the signed-in user, default first. The whole
 * `BusinessProfile` document lives in `payload` (JSONB); the denormalized
 * columns exist only so the picker can sort and search without a JSONB scan.
 */
export async function fetchBusinessProfilesAction(): Promise<
  ActionResult<{ profiles: BusinessProfile[]; summaries: BusinessProfileSummary[] }>
> {
  try {
    const user = await requireUser();
    const supabase = await createServerSupabase();
    if (!supabase) return { ok: false, error: "Cloud saving is not available." };

    const { data, error } = await supabase
      .from("business_profiles")
      .select("id, payload, is_default, updated_at")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) throw error;

    const rows = (data ?? []) as unknown as ProfileRow[];
    const profiles: BusinessProfile[] = [];
    const summaries: BusinessProfileSummary[] = [];

    for (const row of rows) {
      const profile = rowToProfile(row, user.id);
      if (!profile) continue;
      profiles.push(profile);
      summaries.push(toSummary(profile, Boolean(row.is_default), row.updated_at));
    }

    return { ok: true, data: { profiles, summaries } };
  } catch (error) {
    if ((error as Error).message === "UNAUTHENTICATED") {
      return { ok: true, data: { profiles: [], summaries: [] } };
    }
    console.error("[fetchBusinessProfiles]", (error as Error).message);
    return { ok: false, error: "We couldn't load your business profiles." };
  }
}

/**
 * The single profile the app should prefill new invoices from: the flagged
 * default, else the most recently updated. Returns null when none exist.
 */
export async function fetchBusinessProfileAction(): Promise<ActionResult<BusinessProfile | null>> {
  const result = await fetchBusinessProfilesAction();
  if (!result.ok || !result.data) return { ok: false, error: result.error };
  return { ok: true, data: result.data.profiles[0] ?? null };
}

/** Clears the default flag on every profile except `keepId`. */
async function clearOtherDefaults(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabase>>>,
  userId: string,
  keepId: string,
) {
  await supabase
    .from("business_profiles")
    .update({ is_default: false })
    .eq("user_id", userId)
    .neq("id", keepId);
}

/** Row count for this user; null when it can't be read. */
async function countProfiles(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabase>>>,
  userId: string,
): Promise<number | null> {
  const { count, error } = await supabase
    .from("business_profiles")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) return null;
  return count ?? null;
}

export async function setDefaultBusinessProfileAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const supabase = await createServerSupabase();
    if (!supabase) return { ok: false, error: "Cloud saving is not available." };

    // Confirm ownership before clearing anything, so a bogus id cannot strip
    // the account's default flag and then no-op on the update.
    const { data: owned, error: readError } = await supabase
      .from("business_profiles")
      .select("id, is_default")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (readError) throw readError;
    if (!owned) return { ok: false, error: "That profile no longer exists." };

    const { error: clearError } = await supabase
      .from("business_profiles")
      .update({ is_default: false })
      .eq("user_id", user.id)
      .neq("id", id);
    if (clearError) throw clearError;

    // Clear before promoting: `business_profiles_one_default_per_user` rejects
    // two true rows in the same instant.
    const { error } = await supabase
      .from("business_profiles")
      .update({ is_default: true })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;

    revalidatePath("/dashboard/business");
    revalidatePath("/invoices/new");
    return { ok: true };
  } catch (error) {
    if ((error as Error).message === "UNAUTHENTICATED") {
      return { ok: false, error: "Your session expired. Sign in again." };
    }
    console.error("[setDefaultBusinessProfile]", (error as Error).message);
    return { ok: false, error: "We couldn't change your default profile." };
  }
}

export async function deleteBusinessProfileAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const supabase = await createServerSupabase();
    if (!supabase) return { ok: false, error: "Cloud saving is not available." };

    const { data, error } = await supabase
      .from("business_profiles")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("is_default");
    if (error) throw error;
    if (!Array.isArray(data) || data.length === 0) {
      return { ok: false, error: "That profile no longer exists." };
    }

    // Never leave the user with no default while other profiles remain.
    if ((data[0] as { is_default: boolean }).is_default) {
      const { data: next } = await supabase
        .from("business_profiles")
        .select("id")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1);
      const nextId = (next as { id: string }[] | null)?.[0]?.id ?? null;
      if (nextId) {
        await supabase.from("business_profiles").update({ is_default: true }).eq("id", nextId);
      }
    }

    revalidatePath("/dashboard/business");
    revalidatePath("/dashboard");
    revalidatePath("/invoices/new");
    return { ok: true };
  } catch (error) {
    if ((error as Error).message === "UNAUTHENTICATED") {
      return { ok: false, error: "Your session expired. Sign in again." };
    }
    console.error("[deleteBusinessProfile]", (error as Error).message);
    return { ok: false, error: "We couldn't delete that profile." };
  }
}

export async function saveBusinessProfileAction(profile: BusinessProfile): Promise<
  ActionResult<{ id: string }>
> {
  try {
    const parsed = businessProfileSchema.parse(profile);
    const user = await requireUser();
    const supabase = await createServerSupabase();
    if (!supabase) return { ok: false, error: "Cloud saving is not available." };

    // A financial-year rollover resets the sequence before it is persisted.
    const { numbering } = rollNumberingIfYearChanged(parsed.numbering);

    const now = new Date().toISOString();
    const payload: BusinessProfile = { ...parsed, numbering, updatedAt: now };

    const { data: existing, error: readError } = await supabase
      .from("business_profiles")
      .select("id")
      .eq("id", payload.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (readError) throw readError;

    // The first profile of an account becomes the default automatically. Changing
    // which profile is the default is `setDefaultBusinessProfileAction`'s job, so
    // saving never moves the flag.
    const total = existing ? null : await countProfiles(supabase, user.id);
    const becomesDefault = !existing && total === 0;

    if (becomesDefault) await clearOtherDefaults(supabase, user.id, payload.id);

    const { error } = await supabase.from("business_profiles").upsert(
      {
        id: payload.id,
        user_id: user.id,
        display_name: payload.party.name || "My business",
        payload,
        updated_at: now,
        // Omitted for existing rows: PostgREST only updates the columns it is
        // given, so re-saving a profile never steals the default flag.
        ...(existing ? {} : { is_default: becomesDefault }),
      },
      { onConflict: "id" },
    );
    if (error) throw error;

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/business");
    revalidatePath("/invoices/new");
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
