"use client";

import { useState } from "react";
import { Check, FileDown, Image as ImageIcon, Loader2 } from "lucide-react";
import { exportInvoiceJpeg, exportInvoicePdf } from "@/lib/export/export-invoice";
import { useInvoiceStore } from "@/lib/store/invoice-store";
import { Alert, Button } from "@/components/ui";

type Phase = "idle" | "working" | "done" | "error";

export function ExportControls({ compact = false }: { compact?: boolean }) {
  const invoice = useInvoiceStore((s) => s.invoice);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [issues, setIssues] = useState<{ label: string; message: string }[]>([]);

  async function run(kind: "pdf" | "jpeg") {
    setPhase("working");
    setMessage("Preparing your invoice…");
    setIssues([]);

    const result = kind === "pdf" ? await exportInvoicePdf(invoice) : await exportInvoiceJpeg(invoice);

    if (result.ok) {
      setPhase("done");
      setMessage(
        result.pageCount && result.pageCount > 1
          ? `Download ready — ${result.pageCount} pages.`
          : "Download ready.",
      );
      setTimeout(() => setPhase("idle"), 3500);
      return;
    }

    setPhase("error");
    setIssues(result.issues ?? []);
    setMessage(result.error ?? "We couldn't generate the invoice file. Please try again.");
  }

  const busy = phase === "working";

  return (
    <div className={compact ? "flex items-center gap-2" : "space-y-3"}>
      <div className="flex items-center gap-2">
        <Button type="button" variant="primary" onClick={() => void run("pdf")} disabled={busy} size={compact ? "sm" : "md"}>
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <FileDown className="size-3.5" aria-hidden />}
          Download PDF
        </Button>
        <Button type="button" onClick={() => void run("jpeg")} disabled={busy} size={compact ? "sm" : "md"}>
          <ImageIcon className="size-3.5" aria-hidden />
          Download JPEG
        </Button>
      </div>

      {/* Non-blocking status region. Compact mode stays quiet on success so the
          toolbar keeps its tight layout, but errors are never swallowed — the
          pre-export gate is the only thing telling the user what is wrong. */}
      {message && (!compact || phase === "error") ? (
        phase === "error" ? (
          <Alert tone="error" title={message}>
            {issues.length > 0 ? (
              <ul className="mt-1 space-y-0.5">
                {issues.slice(0, 6).map((issue, index) => (
                  <li key={index}>
                    <strong>{issue.label}:</strong> {issue.message}
                  </li>
                ))}
              </ul>
            ) : (
              "If this keeps happening, try reloading the page."
            )}
          </Alert>
        ) : (
          <p aria-live="polite" className="flex items-center gap-1.5 text-xs text-shell-500">
            {phase === "done" ? <Check className="size-3.5 text-emerald-600" aria-hidden /> : null}
            {message}
          </p>
        )
      ) : null}
    </div>
  );
}
