"use client";

import { calculateInvoiceTotals } from "@/lib/invoice/calculate";
import { paginateInvoiceItems } from "@/lib/invoice/paginate";
import { collectInvoiceIssues } from "@/lib/validation/invoice-schema";
import type { Invoice } from "@/types/invoice";
import { buildExportFilename, triggerDownload } from "./filename";

export interface ExportOutcome {
  ok: boolean;
  error?: string;
  issues?: { label: string; message: string }[];
  pageCount?: number;
}

/** Pre-export quality gate: validate, then recalculate from scratch. */
function prepare(invoice: Invoice) {
  const issues = collectInvoiceIssues(invoice);
  if (issues.length > 0) return { issues };
  // Never trust cached UI state — recompute.
  const totals = calculateInvoiceTotals(invoice);
  const pagination = paginateInvoiceItems(invoice, totals);
  return { totals, pagination };
}

export async function exportInvoicePdf(invoice: Invoice): Promise<ExportOutcome> {
  const prepared = prepare(invoice);
  if (prepared.issues) return { ok: false, issues: prepared.issues, error: "Fix the highlighted fields to export." };

  try {
    // Loaded lazily so @react-pdf/renderer never ships in the initial bundle.
    const [{ pdf }, { InvoicePdfDocument, ensurePdfFonts }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("./pdf-document"),
    ]);

    const useInter = await ensurePdfFonts(window.location.origin);
    const element = InvoicePdfDocument({ invoice, totals: prepared.totals!, useInter });
    const blob = await pdf(element as never).toBlob();

    triggerDownload(blob, buildExportFilename({ number: invoice.number, clientName: invoice.client.name }, "pdf"));
    return { ok: true, pageCount: prepared.pagination!.pageCount };
  } catch (error) {
    console.error("[export:pdf]", (error as Error).message);
    return { ok: false, error: "We couldn't generate the invoice file. Please try again." };
  }
}

const JPEG_SCALE = 2.6; // ≈ 200 DPI at A4 — sharp for print and WhatsApp.

export async function exportInvoiceJpeg(invoice: Invoice): Promise<ExportOutcome> {
  const prepared = prepare(invoice);
  if (prepared.issues) return { ok: false, issues: prepared.issues, error: "Fix the highlighted fields to export." };

  try {
    const { domToBlob } = await import("modern-screenshot");
    const root = document.getElementById("invoice-export-root");
    if (!root) throw new Error("preview root missing");

    const pageNodes = Array.from(root.querySelectorAll<HTMLElement>("[data-invoice-page]"));
    if (pageNodes.length === 0) throw new Error("no pages rendered");

    const base = buildExportFilename({ number: invoice.number, clientName: invoice.client.name }, "jpg").replace(/\.jpg$/, "");

    const blobs = await Promise.all(
      pageNodes.map((node) =>
        domToBlob(node, {
          type: "image/jpeg",
          quality: 0.94,
          scale: JPEG_SCALE,
          backgroundColor: invoice.brand.surface,
          // Only the invoice artwork is captured — app chrome is outside this node.
          filter: (element) =>
            !(element instanceof Element && element.classList?.contains("no-print")),
        }),
      ),
    );

    if (blobs.length === 1) {
      triggerDownload(blobs[0] as Blob, `${base}.jpg`);
    } else {
      // Multi-page invoices are packaged as a ZIP of individual JPEGs.
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      blobs.forEach((blob, index) => zip.file(`${base}-page-${index + 1}.jpg`, blob as Blob));
      const archive = await zip.generateAsync({ type: "blob" });
      triggerDownload(archive, `${base}-jpeg.zip`);
    }

    return { ok: true, pageCount: blobs.length };
  } catch (error) {
    console.error("[export:jpeg]", (error as Error).message);
    return { ok: false, error: "We couldn't generate the invoice image. Please try again." };
  }
}
