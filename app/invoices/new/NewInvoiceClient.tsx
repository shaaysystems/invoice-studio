"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BriefcaseBusiness, FilePlus2, Loader2, Sparkles } from "lucide-react";
import { InvoiceEditor } from "@/components/editor/InvoiceEditor";
import { AppShell } from "@/components/dashboard/AppShell";
import { createDemoInvoice, createEmptyInvoice, invoiceFromSavedProfile } from "@/lib/invoice/defaults";
import { defaultPrefix, generateInvoiceNumber } from "@/lib/invoice/numbering";
import { useBusinessProfiles } from "@/lib/hooks/use-business-profiles";
import { localStore } from "@/lib/storage/local";
import { useInvoiceStore } from "@/lib/store/invoice-store";
import { Alert, Button, Skeleton } from "@/components/ui";
import type { Invoice } from "@/types/invoice";

/** Which strip button produced the current invoice — `null` until auto-prefilled. */
type Source = "blank" | "profile" | "demo" | null;

export function NewInvoiceClient({ authenticated }: { authenticated: boolean }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  /** Set once the draft check has run, so the profile fetch can drive the prefill. */
  const [draftChecked, setDraftChecked] = useState(false);
  /** Guards the late-arrival prefill: an explicit pick is never second-guessed. */
  const [source, setSource] = useState<Source>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const applyBusinessProfile = useInvoiceStore((s) => s.applyBusinessProfile);
  const { profiles, active, loading, error, reload } = useBusinessProfiles(authenticated);

  const fallbackNumber = useMemo(
    () => generateInvoiceNumber({ prefix: defaultPrefix(), nextSequence: 1, padding: 3 }),
    [],
  );

  const startBlank = useCallback(() => {
    localStore.saveDraft(null);
    setNotice(null);
    setSource("blank");
    setInvoice(createEmptyInvoice({ number: fallbackNumber }));
  }, [fallbackNumber]);

  // Resume an unfinished draft before anything else touches the invoice.
  useEffect(() => {
    const draft = localStore.getDraft();
    if (draft) setInvoice(draft);
    setDraftChecked(true);
  }, []);

  // Prefill from the default profile once we know there is no draft.
  useEffect(() => {
    if (!draftChecked || invoice || loading) return;
    setInvoice(active ? invoiceFromSavedProfile(active) : createEmptyInvoice({ number: fallbackNumber }));
  }, [draftChecked, invoice, loading, active, fallbackNumber]);

  // A profile arriving late (slow network) should still fill a blank invoice —
  // but never one the user deliberately blanked or replaced.
  useEffect(() => {
    if (!draftChecked || source || !invoice || !active) return;
    if (invoice.business.name.trim()) return;
    setInvoice(invoiceFromSavedProfile(active));
  }, [draftChecked, source, invoice, active]);

  /** Fills the sender details in place, so line items survive the click. */
  const chooseProfile = useCallback(
    (profileId: string) => {
      const profile = profiles.find((entry) => entry.id === profileId);
      if (!profile) return;
      setSource("profile");
      applyBusinessProfile(profile);
      setNotice(`Started from "${profile.party.name}". Line items, client and invoice number are yours.`);
    },
    [profiles, applyBusinessProfile],
  );

  const profileMissing = draftChecked && !loading && profiles.length === 0;

  if (!invoice) {
    return (
      <AppShell authenticated={authenticated}>
        <div className="space-y-3 p-6">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell authenticated={authenticated} bare>
      <div className="no-print border-b border-shell-200 bg-white px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-widest text-shell-500">
            Start from
          </span>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={startBlank}
            title="Empty invoice, nothing prefilled"
          >
            <FilePlus2 className="size-3.5" aria-hidden />
            Blank invoice
          </Button>

          {loading ? (
            <span className="flex items-center gap-1.5 text-[11px] text-shell-500">
              <Loader2 className="size-3 animate-spin" aria-hidden />
              Loading your profiles…
            </span>
          ) : (
            profiles.map((profile) => (
              <Button
                key={profile.id}
                type="button"
                size="sm"
                variant={profile.id === active?.id ? "primary" : "secondary"}
                onClick={() => chooseProfile(profile.id)}
                title={
                  profile.id === active?.id
                    ? "Your default — new invoices start here"
                    : `Load "${profile.party.name}" onto this invoice`
                }
              >
                <BriefcaseBusiness className="size-3.5" aria-hidden />
                {profile.party.name || "Untitled business"}
              </Button>
            ))
          )}

          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={() => {
              setSource("demo");
              setInvoice({ ...createDemoInvoice() });
              setNotice(null);
            }}
            title="Clearly-marked demo content"
          >
            <Sparkles className="size-3.5" aria-hidden />
            Demo invoice
          </Button>
        </div>
      </div>

      {notice || error || profileMissing ? (
        <div className="no-print px-4 pt-3">
          {error ? (
            <Alert tone="error" title="Saved profiles unavailable">
              {error} You can still fill the fields in manually, or{" "}
              <button type="button" onClick={reload} className="font-medium underline underline-offset-2">
                try loading them again
              </button>
              .
            </Alert>
          ) : profileMissing && !notice ? (
            <Alert
              tone="info"
              title={authenticated ? "No business profiles on this account yet" : "No business profiles saved in this browser"}
            >
              Save your sender details once and every new invoice starts pre-filled.{" "}
              <Link href="/dashboard/business" className="font-medium underline underline-offset-2">
                Add a business profile
              </Link>
              .
            </Alert>
          ) : (
            <Alert tone="success">{notice}</Alert>
          )}
        </div>
      ) : null}

      <InvoiceEditor authenticated={authenticated} initialInvoice={invoice} />
    </AppShell>
  );
}
