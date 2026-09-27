// app/auth/sign-out/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Sign-out is a state change, so POST is the safe primary. A GET handler is
 * provided for plain links, which is why it redirects instead of rendering
 * anything — and it never accepts a redirect target from the query string.
 */
async function signOut(request: NextRequest, redirectTo: string | null) {
  const supabase = await createServerSupabase();
  if (supabase) await supabase.auth.signOut();
  return NextResponse.redirect(new URL(redirectTo ?? "/", request.nextUrl.origin));
}

export async function POST(request: NextRequest) {
  return signOut(request, "/");
}

export async function GET(request: NextRequest) {
  return signOut(request, "/");
}
