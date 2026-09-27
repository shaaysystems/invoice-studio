export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_GUEST_IMAGE_BYTES = 900 * 1024; // data URLs live in localStorage
/** QR codes are read by a scanner, so a tighter cap keeps them crisp. */
export const MAX_QR_BYTES = 512 * 1024;

export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
] as const;

const EXTENSION_BY_TYPE: Record<string, string[]> = {
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/webp": ["webp"],
  "image/svg+xml": ["svg"],
};

export interface FileValidationResult {
  ok: boolean;
  error?: string;
}

export interface FileValidationOptions {
  maxBytes?: number;
  /** SVG is rejected for QR codes, where raster fidelity matters more. */
  allowSvg?: boolean;
}

export function validateImageFile(
  file: { name: string; size: number; type: string },
  options: FileValidationOptions = {},
): FileValidationResult {  const maxBytes = options.maxBytes ?? MAX_IMAGE_BYTES;
  const allowSvg = options.allowSvg ?? true;

  const allowed = ALLOWED_IMAGE_TYPES.filter((t) => allowSvg || t !== "image/svg+xml");

  if (!allowed.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return {
      ok: false,
      error: `Use a ${allowSvg ? "PNG, JPG, WEBP or SVG" : "PNG, JPG or WEBP"} image.`,
    };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!EXTENSION_BY_TYPE[file.type]?.includes(ext)) {
    return { ok: false, error: "The file extension doesn't match the file contents." };
  }

  if (file.size > maxBytes) {
    const mb = (maxBytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "");
    return { ok: false, error: `Keep the image under ${mb} MB.` };
  }

  if (file.size === 0) return { ok: false, error: "That file appears to be empty." };

  return { ok: true };
}

/**
 * Upload kinds and their per-kind rules. The API route validates against the
 * same table, so a hand-crafted request cannot bypass the client's checks.
 */
export const ASSET_RULES = {
  logo: { allowSvg: true, maxBytes: MAX_IMAGE_BYTES },
  signature: { allowSvg: true, maxBytes: MAX_IMAGE_BYTES },
  "payment-qr": { allowSvg: false, maxBytes: MAX_QR_BYTES },
} as const;

export type AssetKind = keyof typeof ASSET_RULES;

export function isAssetKind(value: string): value is AssetKind {
  return Object.hasOwn(ASSET_RULES, value);
}

export function validateAssetFile(
  kind: AssetKind,
  file: { name: string; size: number; type: string },
): FileValidationResult {
  const rules = ASSET_RULES[kind];
  return validateImageFile(file, { allowSvg: rules.allowSvg, maxBytes: rules.maxBytes });
}

/** Randomised, path-traversal-safe storage key. Never reuses the client filename. */
export function buildStoragePath(userId: string, kind: string, mimeType: string): string {
  const ext = EXTENSION_BY_TYPE[mimeType]?.[0] ?? "bin";
  const random = globalThis.crypto.randomUUID().replace(/-/g, "");
  const safeKind = kind.replace(/[^a-z0-9-]/gi, "").slice(0, 24) || "asset";
  return `${userId}/${safeKind}/${Date.now()}-${random}.${ext}`;
}

/**
 * Recovers the storage key from a Supabase public or signed URL.
 *
 * The schema stores only a URL, and a saved invoice carries no separate path,
 * so deletion is derived from the URL rather than tracked alongside it. Returns
 * null for any URL that is not a storage object in this bucket, and rejects
 * traversal attempts; the caller still enforces per-user ownership.
 */
export function storagePathFromUrl(url: string, bucket: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  for (const variant of ["sign", "public"]) {
    const prefix = `/storage/v1/object/${variant}/${bucket}/`;
    if (!pathname.startsWith(prefix)) continue;
    const path = decodeURIComponent(pathname.slice(prefix.length));
    if (!path || path.includes("..") || path.includes("\\")) return null;
    return path;
  }
  return null;
}
