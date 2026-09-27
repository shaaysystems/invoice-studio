"use client";

import {
  ASSET_RULES,
  MAX_GUEST_IMAGE_BYTES,
  validateAssetFile,
  type AssetKind,
} from "@/lib/validation/file";

export interface UploadResult {
  ok: boolean;
  /** A data URL in guest mode, or a public storage URL when signed in. */
  url?: string;
  error?: string;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

const isDataUrl = (url: string) => url.startsWith("data:");

/**
 * Uploads to Supabase Storage when signed in; otherwise inlines a data URL so
 * guest mode still works end-to-end (including in exports). The caller only
 * ever receives a URL, which is all the schema stores.
 *
 * Per-kind limits come from `ASSET_RULES` — the same table the server checks —
 * so the editor rejects a bad file before spending bandwidth on it. Guest mode
 * is capped lower still, because data URLs are written to localStorage.
 */
export async function uploadAsset(
  file: File,
  kind: AssetKind,
  options: { authenticated: boolean },
): Promise<UploadResult> {
  const rules = ASSET_RULES[kind];
  const maxBytes = options.authenticated ? rules.maxBytes : Math.min(rules.maxBytes, MAX_GUEST_IMAGE_BYTES);
  const validation = validateAssetFile(kind, { name: file.name, size: file.size, type: file.type });
  if (!validation.ok) return { ok: false, error: validation.error };
  if (file.size > maxBytes) {
    const mb = (maxBytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "");
    return { ok: false, error: `Keep the image under ${mb} MB.` };
  }

  if (!options.authenticated) {
    try {
      return { ok: true, url: await fileToDataUrl(file) };
    } catch {
      return { ok: false, error: "We couldn't read that image. Try a different file." };
    }
  }

  try {
    const body = new FormData();
    body.append("file", file);
    body.append("kind", kind);
    const response = await fetch("/api/upload", { method: "POST", body });
    const payload = (await response.json()) as { url?: string; error?: string };

    if (!response.ok || !payload.url) {
      return { ok: false, error: payload.error ?? "The upload failed. Please try again." };
    }
    return { ok: true, url: payload.url };
  } catch {
    return { ok: false, error: "The upload failed. Check your connection and try again." };
  }
}

/**
 * The schema stores only a URL, so deletion is delegated to the server, which
 * re-derives the path and verifies it belongs to the caller. Guest data URLs
 * have nothing to clean up.
 */
export async function deleteAsset(url: string | null | undefined): Promise<void> {
  if (!url || isDataUrl(url)) return;
  try {
    await fetch("/api/upload", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    });
  } catch {
    // Orphaned storage objects are cleaned up out-of-band; never block the UI.
  }
}
