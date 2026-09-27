// app/error.tsx
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app]", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12 text-center">
      <h1 className="text-xl font-semibold tracking-tight text-shell-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-shell-500">
        Your invoices are safe — nothing was deleted. Try again, and if it keeps happening reload the page.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-[11px] text-shell-400">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex justify-center gap-2">
        <Button type="button" variant="primary" onClick={reset}>
          Try again
        </Button>
        <Button type="button" variant="secondary" onClick={() => window.location.assign("/")}>
          Go home
        </Button>
      </div>
    </main>
  );
}
