"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchBusinessProfilesAction,
  type BusinessProfileSummary,
} from "@/lib/actions/business";
import { localStore } from "@/lib/storage/local";
import type { BusinessProfile } from "@/types/business";

export interface BusinessProfilesState {
  /** Default first, then most recently updated. */
  profiles: BusinessProfile[];
  summaries: BusinessProfileSummary[];
  /** The profile new invoices prefill from, or null when none are usable. */
  active: BusinessProfile | null;
  loading: boolean;
  /** Set when the cloud read failed; the browser copy is used instead. */
  error: string | null;
  reload: () => void;
}

/** A profile only counts once the sender has a name — otherwise prefill is noise. */
function isUsable(profile: BusinessProfile | null): profile is BusinessProfile {
  return Boolean(profile && profile.party.name.trim());
}

function firstUsable(profiles: BusinessProfile[]): BusinessProfile | null {
  return profiles.find(isUsable) ?? null;
}

/** Summaries for browser-only profiles, so the picker has no `any` holes. */
function localSummaries(profiles: BusinessProfile[], activeId: string | null): BusinessProfileSummary[] {
  return profiles.map((profile) => ({
    id: profile.id,
    name: profile.party.name.trim() || "Untitled business",
    gstin: profile.party.gstin,
    city: profile.party.address.city,
    isDefault: profile.id === activeId,
    updatedAt: profile.updatedAt,
  }));
}

/**
 * Reads every saved business profile. Signed-in users get the account copy and
 * it is mirrored into localStorage, so opening the app on a device whose
 * browser copy was never written doesn't show a blank "your business" form.
 * Guests read this browser's list instead.
 */
export function useBusinessProfiles(authenticated: boolean): BusinessProfilesState {
  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<BusinessProfileSummary[]>([]);
  const [loading, setLoading] = useState(authenticated);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    if (!authenticated) {
      const local = localStore.listBusinessProfiles();
      const active = localStore.getBusinessProfile();
      setProfiles(local);
      setActiveId(active?.id ?? null);
      setSummaries(localSummaries(local, active?.id ?? null));
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    (async () => {
      const result = await fetchBusinessProfilesAction();
      if (cancelled) return;

      if (result.ok) {
        const { profiles: cloud, summaries: cloudSummaries } = result.data!;
        // The server already sorts default-first; keep localStorage in step so a
        // later guest visit previews the same profile.
        const defaultId = cloudSummaries.find((entry) => entry.isDefault)?.id ?? cloud[0]?.id ?? null;
        localStore.replaceBusinessProfiles(cloud, defaultId);
        setProfiles(cloud);
        setActiveId(defaultId);
        setSummaries(cloudSummaries);
        setError(null);
      } else {
        const local = localStore.listBusinessProfiles();
        const active = localStore.getBusinessProfile();
        setProfiles(local);
        setActiveId(active?.id ?? null);
        setSummaries(localSummaries(local, active?.id ?? null));
        setError(result.error ?? "We couldn't load your saved business profiles.");
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [authenticated, nonce]);

  const active = useMemo(
    () => profiles.find((profile) => profile.id === activeId && isUsable(profile)) ?? firstUsable(profiles),
    [profiles, activeId],
  );

  return { profiles, summaries, active, loading, error, reload };
}
