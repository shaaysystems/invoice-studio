// app/auth/callback/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/** Only same-origin paths, so a crafted `?next=` can't become an open redirect. */
function safeNext(raw: string | null): string {
  if (!raw) return "/dashboard";
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
}

/**
 * OAuth / magic-link landing. Supabase hands back a `code` to exchange for a
 * session, so the server sets the auth cookies before redirecting.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  // Returning an error back to sign-in keeps the message in one place.
  if (searchParams.get("error")) {
    return NextResponse.redirect(`${origin}/sign-in?error=account`);
  }

  const supabase = await createServerSupabase();
  if (!supabase || !code) return NextResponse.redirect(`${origin}/sign-in?error=session`);

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/sign-in?error=session`);

  return NextResponse.redirect(`${origin}${next}`);
}
