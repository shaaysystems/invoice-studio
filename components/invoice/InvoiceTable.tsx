import { formatINR, formatPercent, formatQuantity } from "@/lib/formatting/inr";
import { unscaleQuantity } from "@/lib/money";
import type { InvoiceTokens } from "@/lib/brand/tokens";
import type { TableLayout } from "@/lib/invoice/layout-metrics";
import type { PaginatedRow } from "@/lib/invoice/paginate";

interface Props {
  tokens: InvoiceTokens;
  layout: TableLayout;
  rows: PaginatedRow[];
  rowHeights: number[];
  continuedFromPrevious: boolean;
  continuesOnNext: boolean;
}

const cell = (width: number, align: "left" | "right" | "center" = "left"): React.CSSProperties => ({
  width: `${width}pt`,
  flexShrink: 0,
  textAlign: align,
  paddingLeft: "4pt",
  paddingRight: "4pt",
  boxSizing: "border-box",
});

export function InvoiceTable({
  tokens,
  layout,
  rows,
  rowHeights,
  continuedFromPrevious,
  continuesOnNext,
}: Props) {
  const { columns, showHsn, showTaxColumn, showUnit } = layout;

  return (
    <section style={{ marginTop: "14pt" }}>
      {continuedFromPrevious ? (
        <div style={{ color: tokens.inkSubtle, fontSize: "7pt", marginBottom: "4pt" }} className="tracked-label">
          Items continued
        </div>
      ) : null}

      {/* Table header — repeated on every page that carries rows. */}
      <div
        role="row"
        style={{
          display: "flex",
          alignItems: "center",
          height: "21pt",
          backgroundColor: tokens.tableHeadBg,
          borderTop: `1.2pt solid ${tokens.ruleStrong}`,
          borderBottom: `0.75pt solid ${tokens.rule}`,
          color: tokens.tableHeadInk,
          fontSize: "6.9pt",
          fontWeight: 600,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
        }}
      >
        <div style={cell(columns.index)}>#</div>
        <div style={cell(columns.description)}>Item description</div>
        {showHsn ? <div style={cell(columns.hsn, "left")}>HSN/SAC</div> : null}
        <div style={cell(columns.qty, "right")}>Qty</div>
        {showUnit ? <div style={cell(columns.unit, "left")}>Unit</div> : null}
        <div style={cell(columns.rate, "right")}>Rate</div>
        {showTaxColumn ? <div style={cell(columns.taxPct, "right")}>GST</div> : null}
        <div style={cell(columns.amount, "right")}>Amount</div>
      </div>

      {/* Rows. Heights come from the shared metrics module, so the DOM preview,
      the PDF and the JPEG all break pages at exactly the same row. */}
      {rows.map((row, index) => (
        <div
          key={row.item.id}
          role="row"
          style={{
            display: "flex",
            alignItems: "flex-start",
            minHeight: `${rowHeights[index] ?? 30}pt`,
            paddingTop: "7pt",
            paddingBottom: "7pt",
            borderBottom: `0.5pt solid ${tokens.rule}`,
            backgroundColor: index % 2 === 1 ? tokens.rowAltBg : "transparent",
          }}
        >
          <div style={{ ...cell(columns.index), color: tokens.inkSubtle, fontSize: "7.6pt", paddingTop: "1pt" }}>
            {String(row.serial).padStart(2, "0")}
          </div>

          <div style={{ ...cell(columns.description), minWidth: 0 }}>
            <div
              style={{
                color: tokens.ink,
                fontSize: "9.2pt",
                fontWeight: 600,
                lineHeight: 1.3,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                overflowWrap: "anywhere",
              }}
            >
              {row.item.description || "Untitled item"}
            </div>
          </div>

          {showHsn ? (
            <div style={{ ...cell(columns.hsn), color: tokens.inkMuted, fontSize: "8pt" }} className="tabular">
              {row.item.hsn}
            </div>
          ) : null}

          <div style={{ ...cell(columns.qty, "right"), color: tokens.ink, fontSize: "8.8pt" }} className="tabular">
            {formatQuantity(unscaleQuantity(row.item.quantity))}
          </div>

          {showUnit ? (
            <div style={{ ...cell(columns.unit), color: tokens.inkMuted, fontSize: "8pt" }}>{row.item.unit}</div>
          ) : null}

          <div style={{ ...cell(columns.rate, "right"), color: tokens.ink, fontSize: "8.8pt" }} className="tabular">
            {formatINR(row.item.rateMinor)}
          </div>

          {showTaxColumn ? (
            <div style={{ ...cell(columns.taxPct, "right"), color: tokens.inkMuted, fontSize: "8pt" }} className="tabular">
              {formatPercent(row.item.taxRate)}
            </div>
          ) : null}

          <div
            style={{ ...cell(columns.amount, "right"), color: tokens.ink, fontSize: "9pt", fontWeight: 600 }}
            className="tabular"
          >
            {formatINR(row.line?.grossMinor ?? 0)}
          </div>
        </div>
      ))}

      {continuesOnNext ? (
        <div style={{ marginTop: "5pt", textAlign: "right", color: tokens.inkSubtle, fontSize: "7.2pt" }}>
          Continued on the next page →
        </div>
      ) : null}
    </section>
  );
}
