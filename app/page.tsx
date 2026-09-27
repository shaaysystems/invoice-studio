import Link from "next/link";
import { ArrowRight, FileDown, Image as ImageIcon, IndianRupee, Palette, ShieldCheck, Sparkles } from "lucide-react";
import { LandingInvoiceMockup } from "@/components/marketing/LandingInvoiceMockup";

const FEATURES = [
  { icon: Palette, title: "Four brand colours", body: "Set primary, accent, surface and text. The document applies them semantically — not randomly." },
  { icon: IndianRupee, title: "INR done properly", body: "Indian digit grouping everywhere: ₹1,00,000 and ₹1,25,50,000, in the editor, the PDF and the JPEG." },
  { icon: FileDown, title: "Print-ready PDF", body: "True A4 vector PDF with selectable text, automatic page breaks and repeated table headers." },
  { icon: ImageIcon, title: "High-resolution JPEG", body: "Roughly 200 DPI per page — sharp enough for email, WhatsApp and slide decks." },
  { icon: Sparkles, title: "Per-item tax rates", body: "Charge 5% on one line and 18% on another. Rate-wise GST buckets build themselves." },
  { icon: ShieldCheck, title: "GST when you need it", body: "CGST + SGST for intra-state, IGST for inter-state, or no tax at all." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-sm font-semibold tracking-tight text-shell-900">Invoice Studio</span>
        <nav className="flex items-center gap-2">
          <Link href="/dashboard" className="rounded-lg px-3 py-2 text-sm text-shell-700 hover:bg-shell-100">
            View dashboard
          </Link>
          <Link
            href="/invoices/new"
            className="rounded-lg bg-shell-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-shell-700"
          >
            Create an invoice
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-16 pt-8 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
          <div>
            <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-shell-200 bg-shell-50 px-3 py-1 text-[11px] font-medium text-shell-500">
              India-first · GST optional · INR formatting
            </p>
            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-shell-900 sm:text-5xl">
              Create invoices that look as professional as your business.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-shell-500">
              Build branded invoices in minutes. Add your business details, client information, items, payment details
              and brand colours — then export a clean, print-ready invoice.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/invoices/new"
                className="inline-flex items-center gap-2 rounded-lg bg-shell-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-shell-700"
              >
                Start an invoice
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg border border-shell-200 px-5 py-3 text-sm font-medium text-shell-900 transition hover:bg-shell-100"
              >
                View Dashboard
              </Link>
            </div>
            <p className="mt-4 text-xs text-shell-500">
              No account needed to start — drafts are kept in your browser until you sign in.
            </p>
          </div>

          <LandingInvoiceMockup />
        </section>

        <section className="border-y border-shell-200 bg-shell-50 py-16">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-semibold tracking-tight text-shell-900">
              Everything an invoice needs. Nothing it doesn&apos;t.
            </h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="rounded-panel border border-shell-200 bg-white p-5">
                  <feature.icon className="size-4 text-shell-900" aria-hidden />
                  <h3 className="mt-3 text-sm font-semibold text-shell-900">{feature.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-shell-500">{feature.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-shell-900">Four steps to a finished invoice</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Enter your details", "Freelancer or company. Logo, contact, optional GSTIN and PAN."],
              ["Add the client and items", "Unlimited line items with descriptions, units and decimal quantities."],
              ["Choose your colours", "Four brand colours with live contrast checking."],
              ["Export and send", "Download a print-ready PDF or a high-resolution JPEG."],
            ].map(([title, body], index) => (
              <li key={title}>
                <span className="text-xs font-semibold tabular text-shell-300">0{index + 1}</span>
                <h3 className="mt-1.5 text-sm font-semibold text-shell-900">{title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-shell-500">{body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-shell-200 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 text-xs text-shell-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Invoice Studio — working name</span>
          <span>
            Tax fields are provided for invoicing purposes. Verify tax treatment for your business with a qualified
            professional.
          </span>
        </div>
      </footer>
    </div>
  );
}
