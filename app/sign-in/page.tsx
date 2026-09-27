// app/sign-in/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/supabase/server";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to sync your invoices and business profile across devices.",
  robots: { index: false, follow: false },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  if (await getCurrentUser()) redirect("/dashboard");

  const { next = "", error } = await searchParams;
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-8 text-sm font-semibold tracking-tight text-shell-900">
        Invoice Studio
      </Link>

      <div className="rounded-panel border border-shell-200 bg-white p-6">
        <h1 className="text-xl font-semibold tracking-tight text-shell-900">Sign in</h1>
        <p className="mb-5 mt-1 text-sm text-shell-500">
          Your invoices and profile stay on your own account.
        </p>

        {error === "account" ? (
          <div className="mb-4">
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
              That sign-in link was used or has expired. Request a fresh one to continue.
            </p>
          </div>
        ) : null}
        {error === "session" ? (
          <div className="mb-4">
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
              We couldn&rsquo;t complete that sign-in. Please try again.
            </p>
          </div>
        ) : null}

        <SignInForm next={safeNext} accountsEnabled={isSupabaseConfigured} />
      </div>

      <p className="mt-6 text-center text-xs text-shell-500">
        <Link href="/" className="hover:text-shell-900 hover:underline">
          Continue as a guest instead
        </Link>
      </p>
    </main>
  );
}
