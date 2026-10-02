import type { Invoice, InvoiceItem, InvoiceLineTotals, InvoiceTotals } from "@/types/invoice";
import { CONTENT_HEIGHT, CONTINUATION_HEADER_HEIGHT, ROW, computeInvoiceMetrics, type InvoiceMetrics } from "./layout-metrics";

export interface PaginatedRow {
  /** 1-based, continuous across pages. */
  serial: number;
  item: InvoiceItem;
  line: InvoiceLineTotals | undefined;
  height: number;
}

export interface InvoicePageModel {
  pageNumber: number;
  rows: PaginatedRow[];
  isFirst: boolean;
  isLast: boolean;
  /** Renders the "continued from previous page" marker. */
  continuedFromPrevious: boolean;
  /** Renders the "continued on next page" marker. */
  continuesOnNext: boolean;
  /** Totals / payment / terms / signature live on exactly one page. */
  showTail: boolean;
  showTable: boolean;
}

export interface PaginationResult {
  pages: InvoicePageModel[];
  pageCount: number;
  metrics: InvoiceMetrics;
}

/**
 * Deterministic, measurement-free pagination. Because it depends only on the
 * invoice data and the shared metrics, the live preview, the PDF and the JPEG
 * export always produce an identical page count and identical row placement.
 */
export function paginateInvoiceItems(
  invoice: Invoice,
  totals: InvoiceTotals,
  metricsOverride?: InvoiceMetrics,
): PaginationResult {
  const metrics = metricsOverride ?? computeInvoiceMetrics(invoice, totals);

  const rows: PaginatedRow[] = invoice.items.map((item, index) => ({
    serial: index + 1,
    item,
    line: totals.lines[index],
    height: metrics.rowHeights[index] ?? ROW.minHeight,
  }));

  const firstPageCapacity =
    CONTENT_HEIGHT -
    metrics.identityHeaderHeight -
    metrics.partiesHeight -
    metrics.footerHeight -
    ROW.headerHeight;
  const nextPageCapacity =
    CONTENT_HEIGHT - CONTINUATION_HEADER_HEIGHT - metrics.footerHeight - ROW.headerHeight;

  const pages: InvoicePageModel[] = [];
  let cursor = 0;
  let pageNumber = 0;

  do {
    pageNumber += 1;
    const isFirst = pageNumber === 1;
    let remaining = isFirst ? firstPageCapacity : nextPageCapacity;
    const pageRows: PaginatedRow[] = [];

    while (cursor < rows.length) {
      const row = rows[cursor] as PaginatedRow;
      // A single row taller than an empty page must still be placed, or we loop forever.
      if (row.height > remaining && pageRows.length > 0) break;
      remaining -= row.height;
      pageRows.push(row);
      cursor += 1;
    }

    const exhausted = cursor >= rows.length;
    const tailFits = remaining >= metrics.tailHeight;

    pages.push({
      pageNumber,
      rows: pageRows,
      isFirst,
      isLast: false,
      continuedFromPrevious: !isFirst,
      continuesOnNext: !exhausted,
      showTail: exhausted && tailFits,
      showTable: true,
    });

    if (exhausted && !tailFits) {
      // The closing blocks need their own page.
      pages.push({
        pageNumber: pageNumber + 1,
        rows: [],
        isFirst: false,
        isLast: false,
        continuedFromPrevious: true,
        continuesOnNext: false,
        showTail: true,
        showTable: false,
      });
      pageNumber += 1;
    }

    if (exhausted) break;
  } while (cursor < rows.length || pages.length === 0);

  const last = pages[pages.length - 1];
  if (last) last.isLast = true;
  // Continuation markers only make sense on multi-page documents.
  if (pages.length === 1 && pages[0]) pages[0].continuesOnNext = false;

  return { pages, pageCount: pages.length, metrics };
}
