export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SUPABASE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET ?? "invoice-assets";

/** The app degrades to guest/local mode when Supabase is not configured. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/**
 * Canonical origin for metadata, Open Graph, robots.txt and sitemap.xml.
 *
 * Resolution order: an explicit NEXT_PUBLIC_SITE_URL, then the origin Vercel
 * injects for the deployment, then localhost. Without the Vercel fallback a
 * production deploy would advertise every canonical URL as localhost:3000.
 *
 * Validated and reduced to `.origin` because the root layout runs
 * `new URL(SITE_URL)` at module load — a malformed env value would otherwise
 * fail the production build rather than degrade.
 */
function resolveSiteUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    "http://localhost:3000",
  ];

  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;
    try {
      return new URL(candidate.trim()).origin;
    } catch {
      // Malformed value — fall through to the next candidate.
    }
  }
  return "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl();
