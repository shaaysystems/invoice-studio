// app/sign-up/SignUpForm.tsx
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { signUpAction } from "@/lib/actions/auth";
import { EMPTY_AUTH_STATE } from "@/types/auth";
import { Alert, Button, Field, Input } from "@/components/ui";

export function SignUpForm({ next, accountsEnabled }: { next: string; accountsEnabled: boolean }) {
  const [state, formAction, pending] = useActionState(signUpAction, EMPTY_AUTH_STATE);

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      {!accountsEnabled ? (
        <Alert tone="warning" title="Accounts are off">
          This deployment has no auth keys configured, so signing up is unavailable.{" "}
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

      <Field label="Password" hint="At least 8 characters. A number or symbol makes it stronger.">
        {(p) => (
          <Input
            {...p}
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        )}
      </Field>

      <Button type="submit" variant="primary" disabled={pending || !accountsEnabled} className="w-full justify-center">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {pending ? "Creating your account…" : "Create account"}
      </Button>

      {accountsEnabled ? (
        <p className="text-center text-[11px] leading-relaxed text-shell-500">
          By creating an account you agree to store your invoice data on our servers. Guest invoices never leave
          your browser.
        </p>
      ) : null}
    </form>
  );
}
