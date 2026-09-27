// app/dashboard/settings/SettingsClient.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, SectionCard } from "@/components/ui";
import { AppShell } from "@/components/dashboard/AppShell";
import { clearLocalData, localStorageKeys } from "@/lib/browser-reset";

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-shell-200 py-3 last:border-0">
      <div>
        <p className="text-sm text-shell-900">{title}</p>
        <p className="text-xs text-shell-500">Children&apos;s data stays in this browser only.</p>
      </div>
      {children}
    </div>
  );
}

export function SettingsClient({
  authenticated,
  email,
  memberSince,
  invoiceCount,
}: {
  authenticated: boolean;
  email: string | null;
  memberSince: string | null;
  invoiceCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"signout" | "reset" | null>(null);

  async function handleSignOut() {
    setBusy("signout");
    try {
      await fetch("/auth/sign-out", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  function handleReset() {
    const ok = window.confirm(
      `This permanently deletes ${invoiceCount} invoice(s), your draft, business profile and brand from this browser. Cloud invoices are not affected.\n\nContinue?`,
    );
    if (!ok) return;
    setBusy("reset");
    const cleared = clearLocalData();
    setBusy(null);
    if (cleared) router.refresh();
  }

  return (
    <AppShell authenticated={authenticated}>
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-shell-900">Settings</h1>
          <p className="mt-1 text-sm text-shell-500">Your account and local data.</p>
        </div>

        <SectionCard title="Account">
          {authenticated && email ? (
            <>
              <Row title="Signed in as">
                <span className="text-sm text-shell-700">{email}</span>
              </Row>
              {memberSince ? (
                <Row title="Member since">
                  <span className="text-sm text-shell-700">
                    {new Date(memberSince).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </Row>
              ) : null}
              <Row title={`Invoices on this account (${invoiceCount})`}>
                <span className="text-sm text-shell-700">Synced to the cloud</span>
              </Row>
              <div className="pt-3">
                <Button type="button" variant="secondary" onClick={() => void handleSignOut()} disabled={busy !== null}>
                  {busy === "signout" ? "Signing out…" : "Sign out"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Row title="Guest mode">
                <span className="text-sm text-shell-700">Invoices are saved in this browser</span>
              </Row>
              <Row title={`Invoices in this browser (${invoiceCount})`}>
                <span className="text-sm text-shell-700">Local only</span>
              </Row>
              <div className="pt-3">
                <Button type="button" variant="primary" onClick={() => router.push("/sign-in")}>
                  Sign in to sync
                </Button>
              </div>
            </>
          )}
        </SectionCard>

        <SectionCard title="Local data" description="Clearing this cannot be undone.">
          <Row title={`Delete ${invoiceCount} local invoice(s), draft, profile and brand`}>
            <Button
              type="button"
              variant="danger"
              onClick={handleReset}
              disabled={busy !== null}
            >
              {busy === "reset" ? "Clearing…" : "Clear browser data"}
            </Button>
          </Row>
        </SectionCard>

        <p className="text-[11px] leading-relaxed text-shell-500">
          Clears: {localStorageKeys.join(", ")}. Invoice Studio is a preview, so always keep your own copy of
          issued invoices.
        </p>
      </div>
    </AppShell>
  );
}
