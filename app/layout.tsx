import type { Metadata } from "next";
import { SITE_URL } from "@/lib/supabase/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Invoice Studio — Professional invoices for Indian businesses",
    template: "%s · Invoice Studio",
  },
  description:
    "Build branded, print-ready invoices in minutes. Add your business details, client information, items, payment details and brand colours — then export a clean PDF or JPEG. GST-ready and INR-first.",
  keywords: ["invoice generator India", "GST invoice", "freelancer invoice", "INR invoice", "invoice PDF"],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Invoice Studio",
    title: "Create invoices that look as professional as your business",
    description:
      "Branded, print-ready invoices for Indian freelancers and businesses. GST optional, INR formatting built in, PDF and JPEG export.",
  },
  twitter: { card: "summary_large_image", title: "Invoice Studio" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-shell-900 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to content
        </a>
        <div id="main">{children}</div>
      </body>
    </html>
  );
}
