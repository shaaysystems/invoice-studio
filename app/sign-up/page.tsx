// app/sign-up/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/supabase/server";
import { SignUpForm } from "./SignUpForm";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create an account to sync your invoices and business profile across devices.",
  robots: { index: false, follow: false },
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getCurrentUser()) redirect("/dashboard");

  const { next = "" } = await searchParams;
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-8 text-sm font-semibold tracking-tight text-shell-900">
        Invoice Studio
      </Link>

      <div className="rounded-panel border border-shell-200 bg-white p-6">
        <h1 className="text-xl font-semibold tracking-tight text-shell-900">Create an account</h1>
        <p className="mb-5 mt-1 text-sm text-shell-500">
          Free while in preview. No card required.
        </p>
        <SignUpForm next={safeNext} accountsEnabled={isSupabaseConfigured} />
      </div>

      <p className="mt-6 text-center text-xs text-shell-500">
        Already have an account?{" "}
        <Link
          href={`/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-medium text-shell-900 underline"
        >
          Sign in
        </Link>
      </p>
    </main>
  );
}
