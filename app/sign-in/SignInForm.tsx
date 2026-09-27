// app/sign-in/SignInForm.tsx
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { signInAction } from "@/lib/actions/auth";
import { EMPTY_AUTH_STATE } from "@/types/auth";
import { Alert, Button, Field, Input } from "@/components/ui";

export function SignInForm({ next, accountsEnabled }: { next: string; accountsEnabled: boolean }) {
  const [state, formAction, pending] = useActionState(signInAction, EMPTY_AUTH_STATE);

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="info">{state.message}</Alert> : null}

      {!accountsEnabled ? (
        <Alert tone="warning" title="Accounts are off">
          This deployment has no auth keys configured, so signing in is unavailable.{" "}
          <Link href="/" className="font-medium underline">
            Continue as a guest
          </Link>{" "}
          — invoices are then stored in this browser only.
        </Alert>
      ) : null}

      <Field label="Email">
        {(p) => (
          <Input {...p} name="email" type="email" autoComplete="email" required placeholder="you@studio.com" />
        )}
      </Field>

      <Field label="Password">
        {(p) => (
          <Input
            {...p}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
          />
        )}
      </Field>

      <Button type="submit" variant="primary" disabled={pending || !accountsEnabled} className="w-full justify-center">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      {accountsEnabled ? (
        <p className="text-center text-xs text-shell-500">
          New here?{" "}
          <Link
            href={`/sign-up${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="font-medium text-shell-900 underline"
          >
            Create an account
          </Link>
        </p>
      ) : null}
    </form>
  );
}
