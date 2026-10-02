"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { AuthFormState } from "@/types/auth";

const EMAIL = "Enter a valid email address.";

const SIGN_IN_DISABLED =
  "Accounts aren't enabled on this deployment. Continue as a guest to try Invoice Studio.";
const SIGN_UP_DISABLED = SIGN_IN_DISABLED;

/** Maps Supabase's auth error codes onto copy that tells the user what to do next. */
function explain(error: { code?: string; message: string }): string {
  switch (error.code) {
    case "invalid_credentials":
      return "That email and password don't match an account. Check for typos, or sign up instead.";
    case "email_exists":
    case "user_already_exists":
      return "An account already uses that email. Sign in instead, or reset the password.";
    case "email_not_confirmed":
      return "Confirm your email address first — check your inbox for the link we sent.";
    case "weak_password":
      return "Use a longer password. Eight characters with a number or symbol is a good start.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts just now. Wait a minute and try again.";
    default:
      return error.message || "Something went wrong. Please try again.";
  }
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!isSupabaseConfigured) return { error: SIGN_IN_DISABLED, message: null };

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password.", message: null };

  const supabase = await createServerSupabase();
  if (!supabase) return { error: SIGN_IN_DISABLED, message: null };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: explain(error), message: null };

  const next = String(formData.get("next") ?? "") || "/dashboard";
  // Only allow same-origin paths, so `?next=` can't be used as an open redirect.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!isSupabaseConfigured) return { error: SIGN_IN_DISABLED, message: null };

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: EMAIL, message: null };
  if (password.length < 8) return { error: "Use a password of at least 8 characters.", message: null };

  const supabase = await createServerSupabase();
  if (!supabase) return { error: SIGN_UP_DISABLED, message: null };
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: explain(error), message: null };

  // With email confirmation on there is no session yet; tell the user to check inbox.
  if (!data.session) {
    return {
      error: null,
      message: "Check your inbox for a confirmation link, then sign in.",
    };
  }
  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabase();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}
