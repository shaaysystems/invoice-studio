// app/robots.ts
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/supabase/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Invoice content and account pages should never be indexed.
        disallow: ["/dashboard", "/invoices", "/sign-in", "/sign-up", "/auth", "/dev", "/api"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
