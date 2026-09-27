// types/auth.ts

/**
 * Client-safe auth form state. Kept out of `lib/actions/auth.ts` because a
 * `"use server"` module may only export async functions.
 */
export interface AuthFormState {
  error: string | null;
  message: string | null;
}

export const EMPTY_AUTH_STATE: AuthFormState = { error: null, message: null };
