// app/dashboard/business/BusinessProfileList.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, PencilLine, Plus, Star, Trash2 } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import {
  deleteBusinessProfileAction,
  saveBusinessProfileAction,
  setDefaultBusinessProfileAction,
} from "@/lib/actions/business";
import { newId } from "@/lib/invoice/defaults";
import { formatInvoiceDate } from "@/lib/formatting/inr";
import { useBusinessProfiles } from "@/lib/hooks/use-business-profiles";
import { localStore } from "@/lib/storage/local";
import { Alert, Button, EmptyState, Skeleton } from "@/components/ui";
import type { BusinessProfile } from "@/types/business";

export function BusinessProfileList({ authenticated }: { authenticated: boolean }) {
  const router = useRouter();
  const { profiles, summaries, loading, error, reload } = useBusinessProfiles(authenticated);
  const [notice, setNotice] = useState<{ tone: "info" | "error" | "success"; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function handleAdd() {
    router.push(`/dashboard/business/${newProfileId()}`);
  }

  async function handleSetDefault(profile: BusinessProfile) {
    setBusyId(profile.id);
    if (authenticated) {
      const result = await setDefaultBusinessProfileAction(profile.id);
      if (!result.ok) {
        setNotice({ tone: "error", text: result.error ?? "We couldn't change your default profile." });
        setBusyId(null);
        return;
      }
    } else {
      localStore.setActiveBusinessProfile(profile.id);
    }
    setNotice({
      tone: "success",
      text: `New invoices will now start from "${profile.party.name || "this profile"}".`,
    });
    setBusyId(null);
    reload();
  }

  async function handleDuplicate(profile: BusinessProfile) {
    const copy: BusinessProfile = {
      ...structuredClone(profile),
      id: newProfileId(),
      updatedAt: new Date().toISOString(),
    };
    setBusyId(profile.id);

    if (authenticated) {
      const result = await saveBusinessProfileAction(copy);
      if (!result.ok) {
        setNotice({ tone: "error", text: result.error ?? "We couldn't duplicate that profile." });
        setBusyId(null);
        return;
      }
    } else if (!localStore.saveBusinessProfile(copy)) {
      setNotice({ tone: "error", text: "This browser's storage is full, so nothing was copied." });
      setBusyId(null);
      return;
    }

    setNotice({ tone: "success", text: `Copied "${profile.party.name || "Untitled business"}".` });
    setBusyId(null);
    reload();
  }

  async function handleDelete(profile: BusinessProfile) {
    const name = profile.party.name || "this profile";
    setBusyId(profile.id);

    if (authenticated) {
      const result = await deleteBusinessProfileAction(profile.id);
      if (!result.ok) {
        setNotice({ tone: "error", text: result.error ?? "We couldn't delete that profile." });
        setBusyId(null);
        return;
      }
    } else {
      localStore.deleteBusinessProfile(profile.id);
    }

    setNotice({ tone: "info", text: `Deleted ${name}. Invoices already issued keep their own copy of the details.` });
    setBusyId(null);
    reload();
  }

  return (
    <AppShell authenticated={authenticated}>
      <div className="px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-shell-900">Business profiles</h1>
            <p className="mt-1 max-w-2xl text-sm text-shell-500">
              Keep one profile per business you invoice from. Each holds its own sender details,
              payment block, signature, terms and numbering. Issued invoices keep their own copy, so
              editing a profile never rewrites history.
            </p>
          </div>
          <Button type="button" variant="primary" onClick={handleAdd}>
            <Plus className="size-4" aria-hidden />
            Add business profile
          </Button>
        </div>

        {notice ? (
          <div className="mt-5">
            <Alert tone={notice.tone}>{notice.text}</Alert>
          </div>
        ) : null}

        {error ? (
          <div className="mt-5">
            <Alert tone="error" title="Couldn't load your profiles">
              {error}{" "}
              <button type="button" onClick={reload} className="font-medium underline underline-offset-2">
                Try again
              </button>
            </Alert>
          </div>
        ) : null}

        <div className="mt-7">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : profiles.length === 0 ? (
            <EmptyState
              title="No business profiles yet"
              description="Add one and every new invoice starts pre-filled with your sender details, payment block and terms. You can add more later and pick between them each time you invoice."
              action={
                <Button type="button" variant="primary" onClick={handleAdd}>
                  <Plus className="size-4" aria-hidden />
                  Add your first profile
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {profiles.map((profile) => {
                const summary = summaries.find((entry) => entry.id === profile.id);
                const busy = busyId === profile.id;
                return (
                  <li
                    key={profile.id}
                    className="rounded-panel border border-shell-200 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-shell-900">
                            {summary?.name ?? "Untitled business"}
                          </p>
                          {summary?.isDefault ? (
                            <span className="rounded-full bg-shell-900 px-2 py-0.5 text-[10px] font-medium text-white">
                              Default
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-shell-500">
                          {[
                            profile.party.gstin ? `GSTIN ${profile.party.gstin}` : null,
                            profile.party.address.city ? profile.party.address.city : null,
                            profile.party.email || null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "No GSTIN, city or email yet"}
                        </p>
                        {summary?.updatedAt ? (
                          <p className="mt-0.5 text-[11px] text-shell-500">
                            Last saved {formatInvoiceDate(summary.updatedAt.slice(0, 10), "short")}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-1">
                        <IconAction
                          label={
                            summary?.isDefault
                              ? "Already the default for new invoices"
                              : "Use for new invoices by default"
                          }
                          onClick={() => void handleSetDefault(profile)}
                          disabled={busy || summary?.isDefault}
                        >
                          <Star className="size-3.5" aria-hidden />
                        </IconAction>
                        <IconAction
                          label="Duplicate this profile"
                          onClick={() => void handleDuplicate(profile)}
                          disabled={busy}
                        >
                          <Copy className="size-3.5" aria-hidden />
                        </IconAction>
                        <IconAction label="Delete this profile" danger onClick={() => void handleDelete(profile)} disabled={busy}>
                          <Trash2 className="size-3.5" aria-hidden />
                        </IconAction>
                        <Link
                          href={`/dashboard/business/${profile.id}`}
                          className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-lg border border-shell-200 bg-white px-3 text-xs font-medium text-shell-900 hover:bg-shell-100"
                        >
                          <PencilLine className="size-3.5" aria-hidden />
                          Edit
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {profiles.length > 0 ? (
          <p className="mt-6 text-[11px] text-shell-500">
            Deleting a profile also removes its saved brand kit. Invoices you have already issued are
            never affected.
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}

/** A fresh route id for a profile that does not exist yet. */
function newProfileId(): string {
  return newId();
}

function IconAction({
  label,
  onClick,
  children,
  danger,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`grid size-8 place-items-center rounded-md transition disabled:opacity-40 ${
        danger ? "text-red-600 hover:bg-red-50" : "text-shell-500 hover:bg-shell-100 hover:text-shell-900"
      }`}
    >
      {children}
    </button>
  );
}
