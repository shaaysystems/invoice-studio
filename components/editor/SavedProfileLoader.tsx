"use client";

import { useState } from "react";
import Link from "next/link";
import { BriefcaseBusiness, Check, Loader2, RefreshCw } from "lucide-react";
import { invoiceHasOwnBusinessDetails } from "@/lib/invoice/defaults";
import { useBusinessProfiles } from "@/lib/hooks/use-business-profiles";
import { useInvoiceStore } from "@/lib/store/invoice-store";
import { Alert, Button, Select } from "@/components/ui";

const linkButtonClasses =
  "inline-flex h-8 items-center rounded-lg border border-shell-200 bg-white px-3 text-xs font-medium text-shell-900 hover:bg-shell-100";

/**
 * Copies sender details, the payment block, signature, default terms and notes
 * from one of the saved business profiles onto the invoice being edited. Line
 * items, the client and the invoice number are left alone.
 *
 * Mounted inside a Disclosure, so the account is only read once it's opened.
 */
export function SavedProfileLoader({ authenticated }: { authenticated: boolean }) {
  const invoice = useInvoiceStore((s) => s.invoice);
  const applyBusinessProfile = useInvoiceStore((s) => s.applyBusinessProfile);
  const { profiles, active, loading, error, reload } = useBusinessProfiles(authenticated);
  const [selectedId, setSelectedId] = useState<string>("");
  const [confirming, setConfirming] = useState(false);
  const [appliedName, setAppliedName] = useState<string | null>(null);

  const chosenId = selectedId || active?.id || "";
  const chosen = profiles.find((profile) => profile.id === chosenId) ?? null;

  if (loading) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-shell-500">
        <Loader2 className="size-3 animate-spin" aria-hidden />
        Looking for your saved business profiles…
      </p>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="space-y-2.5">
        <p className="text-[11px] leading-snug text-shell-500">
          {error ?? `You haven't saved a business profile ${authenticated ? "on this account" : "in this browser"} yet. Save your sender details once and every new invoice starts pre-filled.`}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/dashboard/business" className={linkButtonClasses}>
            Add a business profile
          </Link>
          {error ? (
            <Button type="button" size="sm" variant="ghost" onClick={reload}>
              <RefreshCw className="size-3.5" aria-hidden />
              Try again
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const hasOwnDetails = invoiceHasOwnBusinessDetails(invoice);

  function apply() {
    if (!chosen) return;
    applyBusinessProfile(chosen);
    setConfirming(false);
    setAppliedName(chosen.party.name || "Untitled business");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-56 space-y-1.5">
          <label htmlFor="saved-profile-picker" className="block text-xs font-medium text-shell-700">
            Saved business profile
          </label>
          <Select
            id="saved-profile-picker"
            value={chosenId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setAppliedName(null);
              setConfirming(false);
            }}
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.party.name || "Untitled business"}
                {profile.id === active?.id ? " (default)" : ""}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={reload} title="Re-read from your account">
            <RefreshCw className="size-3.5" aria-hidden />
            Refresh
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!chosen}
            onClick={() => {
              setAppliedName(null);
              if (hasOwnDetails) setConfirming(true);
              else apply();
            }}
          >
            <BriefcaseBusiness className="size-3.5" aria-hidden />
            Load this profile
          </Button>
        </div>
      </div>

      {chosen ? (
        <p className="text-[11px] leading-snug text-shell-500">
          {chosen.updatedAt ? `Last saved ${new Date(chosen.updatedAt).toLocaleString()}. ` : ""}
          Fills the sender details, logo, address, GSTIN, payment block, signature, terms and notes.
          Line items, the client and the invoice number are left alone.
        </p>
      ) : null}

      {confirming ? (
        <Alert tone="warning" title="Replace the details on this invoice?">
          <p>
            This overwrites the sender details, payment block, signature, terms and notes you have on
            this invoice with the chosen profile. You can edit them again afterwards.
          </p>
          <div className="mt-2 flex gap-2">
            <Button type="button" size="sm" variant="primary" onClick={apply}>
              Replace with this profile
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Keep what I have
            </Button>
          </div>
        </Alert>
      ) : null}

      {appliedName ? (
        <p role="status" className="flex items-center gap-1.5 text-[11px] text-emerald-700">
          <Check className="size-3" aria-hidden />
          Applied &ldquo;{appliedName}&rdquo; to this invoice.
        </p>
      ) : null}
    </div>
  );
}
