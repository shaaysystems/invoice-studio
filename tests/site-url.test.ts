import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * SITE_URL drives metadataBase, canonical URLs, robots.txt and sitemap.xml.
 * On Vercel it must resolve to the deployed origin — a regression here ships
 * production with every canonical URL pointing at localhost:3000.
 */
async function siteUrlWith(env: Record<string, string | undefined>): Promise<string> {
  const keys = [
    "NEXT_PUBLIC_SITE_URL",
    "VERCEL_PROJECT_PRODUCTION_URL",
    "VERCEL_URL",
  ] as const;

  for (const key of keys) {
    if (key in env) {
      if (env[key] === undefined) delete process.env[key];
      else process.env[key] = env[key];
    }
  }

  vi.resetModules();
  const { SITE_URL } = await import("@/lib/supabase/env");
  return SITE_URL;
}

const ORIGINAL = {
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  VERCEL_URL: process.env.VERCEL_URL,
};

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("SITE_URL", () => {
  it("prefers an explicit NEXT_PUBLIC_SITE_URL", async () => {
    const url = await siteUrlWith({
      NEXT_PUBLIC_SITE_URL: "https://billing.example.com",
      VERCEL_PROJECT_PRODUCTION_URL: "ignored.vercel.app",
    });
    expect(url).toBe("https://billing.example.com");
  });

  it("falls back to the Vercel production origin", async () => {
    const url = await siteUrlWith({
      NEXT_PUBLIC_SITE_URL: undefined,
      VERCEL_PROJECT_PRODUCTION_URL: "invoice-studio.vercel.app",
      VERCEL_URL: "deploy-abc123.vercel.app",
    });
    expect(url).toBe("https://invoice-studio.vercel.app");
  });

  it("uses the deployment VERCEL_URL when no production domain is set", async () => {
    const url = await siteUrlWith({
      NEXT_PUBLIC_SITE_URL: undefined,
      VERCEL_PROJECT_PRODUCTION_URL: undefined,
      VERCEL_URL: "deploy-abc123.vercel.app",
    });
    expect(url).toBe("https://deploy-abc123.vercel.app");
  });

  it("defaults to localhost outside Vercel", async () => {
    const url = await siteUrlWith({
      NEXT_PUBLIC_SITE_URL: undefined,
      VERCEL_PROJECT_PRODUCTION_URL: undefined,
      VERCEL_URL: undefined,
    });
    expect(url).toBe("http://localhost:3000");
  });

  it("normalises trailing slashes and paths to a bare origin", async () => {
    const url = await siteUrlWith({
      NEXT_PUBLIC_SITE_URL: "https://billing.example.com/app/",
      VERCEL_PROJECT_PRODUCTION_URL: undefined,
    });
    expect(url).toBe("https://billing.example.com");
  });

  it("ignores a malformed value instead of failing the build", async () => {
    // The root layout runs `new URL(SITE_URL)` at module load, so a bad value
    // must degrade rather than throw.
    const url = await siteUrlWith({
      NEXT_PUBLIC_SITE_URL: "not a url",
      VERCEL_PROJECT_PRODUCTION_URL: "invoice-studio.vercel.app",
    });
    expect(url).toBe("https://invoice-studio.vercel.app");
  });

  it("survives a malformed value with no Vercel fallback", async () => {
    const url = await siteUrlWith({
      NEXT_PUBLIC_SITE_URL: "http://",
      VERCEL_PROJECT_PRODUCTION_URL: undefined,
      VERCEL_URL: undefined,
    });
    expect(url).toBe("http://localhost:3000");
  });
});
