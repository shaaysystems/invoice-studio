import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { SUPABASE_BUCKET } from "@/lib/supabase/env";
import { buildStoragePath, isAssetKind, storagePathFromUrl, validateAssetFile } from "@/lib/validation/file";

const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Cloud storage is not configured." }, { status: 503 });

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Please sign in to upload files." }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was received." }, { status: 400 });
  }

  // An unknown kind is rejected outright rather than sanitised into a folder
  // name, so the storage layout only ever contains the kinds we define.
  if (!isAssetKind(kind)) {
    return NextResponse.json({ error: "That kind of file cannot be uploaded." }, { status: 400 });
  }

  // Validated against the same per-kind rules the editor uses.
  const validation = validateAssetFile(kind, { name: file.name, size: file.size, type: file.type });
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });

  // Randomised, user-scoped path — the client filename is never trusted.
  const path = buildStoragePath(auth.user.id, kind, file.type);

  const { error: uploadError } = await supabase.storage.from(SUPABASE_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });

  if (uploadError) {
    console.error("[upload] storage failure", { kind, message: uploadError.message });
    return NextResponse.json({ error: "We couldn't store that file. Please try again." }, { status: 500 });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);

  if (signError || !signed?.signedUrl) {
    return NextResponse.json({ error: "The file was stored but could not be loaded." }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl, path });
}

export async function DELETE(request: Request) {
  const supabase = await createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Not configured." }, { status: 503 });

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { url, path } = (await request.json()) as { url?: string; path?: string };
  // The schema stores only a URL, so the key is re-derived server-side rather
  // than trusted from the request body.
  const key = path ?? (url ? storagePathFromUrl(url, SUPABASE_BUCKET) : null);
  // Ownership is enforced server-side, not by the caller.
  if (!key || !key.startsWith(`${auth.user.id}/`)) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 403 });
  }

  await supabase.storage.from(SUPABASE_BUCKET).remove([key]);
  return NextResponse.json({ ok: true });
}
