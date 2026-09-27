import { describe, expect, it } from "vitest";
import {
  buildStoragePath,
  isAssetKind,
  storagePathFromUrl,
  validateAssetFile,
  validateImageFile,
  MAX_IMAGE_BYTES,
  MAX_QR_BYTES,
} from "@/lib/validation/file";

const BUCKET = "invoice-assets";
const USER = "user-123";
const KEY = `${USER}/logo/1700000000-abc.png`;
const BASE = "https://project.supabase.co";

describe("validateImageFile", () => {
  it("accepts a real png", () => {
    expect(
      validateImageFile({ name: "logo.png", size: 2048, type: "image/png" }).ok,
    ).toBe(true);
  });

  it("rejects an unsupported mime type", () => {
    const result = validateImageFile({ name: "logo.gif", size: 2048, type: "image/gif" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/PNG, JPG, WEBP or SVG/);
  });

  it("rejects an extension that contradicts the mime type", () => {
    expect(
      validateImageFile({ name: "logo.png", size: 2048, type: "image/jpeg" }).ok,
    ).toBe(false);
  });

  it("rejects an empty file", () => {
    expect(validateImageFile({ name: "logo.png", size: 0, type: "image/png" }).ok).toBe(false);
  });

  it("enforces the size ceiling", () => {
    expect(
      validateImageFile({ name: "logo.png", size: MAX_IMAGE_BYTES + 1, type: "image/png" }).ok,
    ).toBe(false);
  });

  it("can forbid svg, which QR codes needed", () => {
    const svg = { name: "qr.svg", size: 1024, type: "image/svg+xml" };
    expect(validateImageFile(svg).ok).toBe(true);
    expect(validateImageFile(svg, { allowSvg: false }).ok).toBe(false);
  });
});

describe("asset rules", () => {
  it("knows only the three kinds the app uploads", () => {
    expect(isAssetKind("logo")).toBe(true);
    expect(isAssetKind("signature")).toBe(true);
    expect(isAssetKind("payment-qr")).toBe(true);
    expect(isAssetKind("../../etc")).toBe(false);
    expect(isAssetKind("")).toBe(false);
  });

  it("rejects svg for a payment QR but allows it for a logo", () => {
    const svg = { name: "qr.svg", size: 1024, type: "image/svg+xml" };
    expect(validateAssetFile("logo", svg).ok).toBe(true);
    expect(validateAssetFile("payment-qr", svg).ok).toBe(false);
  });

  it("keeps payment QR images under a tighter cap than a logo", () => {
    const midSize = { name: "logo.png", size: 1 * 1024 * 1024, type: "image/png" };
    expect(validateAssetFile("logo", midSize).ok).toBe(true);
    expect(validateAssetFile("payment-qr", midSize).ok).toBe(false);
  });

  it("enforces each kind's own ceiling", () => {
    const justOverQr = {
      name: "qr.png",
      size: MAX_QR_BYTES + 1,
      type: "image/png",
    };
    expect(validateAssetFile("payment-qr", justOverQr).ok).toBe(false);
    expect(validateAssetFile("logo", justOverQr).ok).toBe(true);
  });
});

describe("buildStoragePath", () => {
  it("scopes the key to the user and the kind", () => {
    const path = buildStoragePath(USER, "logo", "image/png");
    expect(path.startsWith(`${USER}/logo/`)).toBe(true);
    expect(path.endsWith(".png")).toBe(true);
  });

  it("never reuses the client filename", () => {
    const path = buildStoragePath(USER, "logo", "image/png");
    expect(path).not.toContain("../../");
    expect(path.split("/")).toHaveLength(3);
  });

  it("maps jpeg to jpg and sanitises the kind", () => {
    expect(buildStoragePath(USER, "logo", "image/jpeg").endsWith(".jpg")).toBe(true);
    expect(buildStoragePath(USER, "!!sig!!", "image/png").split("/")[1]).toBe("sig");
  });
});

describe("storagePathFromUrl", () => {
  it("recovers the key from a signed url", () => {
    const url = `${BASE}/storage/v1/object/sign/${BUCKET}/${KEY}?token=abc123`;
    expect(storagePathFromUrl(url, BUCKET)).toBe(KEY);
  });

  it("recovers the key from a public url", () => {
    const url = `${BASE}/storage/v1/object/public/${BUCKET}/${KEY}`;
    expect(storagePathFromUrl(url, BUCKET)).toBe(KEY);
  });

  it("ignores the query string", () => {
    const url = `${BASE}/storage/v1/object/sign/${BUCKET}/${KEY}?token=a&download=1`;
    expect(storagePathFromUrl(url, BUCKET)).toBe(KEY);
  });

  it("decodes percent-encoded keys", () => {
    const url = `${BASE}/storage/v1/object/public/${BUCKET}/${USER}/logo/my%20logo.png`;
    expect(storagePathFromUrl(url, BUCKET)).toBe(`${USER}/logo/my logo.png`);
  });

  it("returns null for a foreign bucket", () => {
    const url = `${BASE}/storage/v1/object/public/other-bucket/${KEY}`;
    expect(storagePathFromUrl(url, BUCKET)).toBeNull();
  });

  it("returns null for a non-storage url", () => {
    expect(storagePathFromUrl("data:image/png;base64,AAAA", BUCKET)).toBeNull();
    expect(storagePathFromUrl("https://example.com/logo.png", BUCKET)).toBeNull();
    expect(storagePathFromUrl("not-a-url", BUCKET)).toBeNull();
  });

  it("rejects traversal smuggled in through the url", () => {
    const url = `${BASE}/storage/v1/object/public/${BUCKET}/..%2F..%2Fetc%2Fpasswd`;
    expect(storagePathFromUrl(url, BUCKET)).toBeNull();
  });

  it("does not invent a key for another user's object", () => {
    // The helper is bucket-scoped only; ownership is the route's job.
    const url = `${BASE}/storage/v1/object/public/${BUCKET}/other-user/logo/x.png`;
    expect(storagePathFromUrl(url, BUCKET)).toBe("other-user/logo/x.png");
  });
});
