/** Longest filename we will ever emit, keeping exports safe for old filesystems. */
const MAX_FILENAME_LENGTH = 120;

export type ExportExtension = "pdf" | "jpg" | "png";

export interface ExportFilenameSource {
  number: string;
  clientName: string;
}

/** Strips path separators, control characters and reserved names. */
export function sanitizeFilename(input: string, fallback = "invoice"): string {
  const cleaned = (input || "")
    .normalize("NFKD")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);
  return cleaned || fallback;
}

/**
 * `INV-2026-001` + `Acme Pvt Ltd` -> `INV-2026-001-Acme-Pvt-Ltd.pdf`.
 * Falls back to a stable `invoice.<ext>` when both parts are empty.
 */
export function buildExportFilename(
  source: ExportFilenameSource,
  extension: ExportExtension,
): string {
  const ext = extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "pdf";
  const parts = [source.number, source.clientName]
    .map((part) => sanitizeFilename(part, ""))
    .filter((part) => part.length > 0);

  const suffix = `.${ext}`;
  const budget = MAX_FILENAME_LENGTH - suffix.length;
  const base = (parts.join("-") || "invoice").slice(0, budget);
  return `${base}${suffix}`;
}

export function invoiceFileBase(invoiceNumber: string): string {
  return `invoice-${sanitizeFilename(invoiceNumber, "draft")}`;
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give Safari a beat before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
