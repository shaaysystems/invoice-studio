// app/sitemap.ts
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/supabase/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
  ];
}
