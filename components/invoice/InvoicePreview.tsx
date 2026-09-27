"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { PAGE } from "@/lib/invoice/layout-metrics";
import { cn } from "@/lib/utils";
import type { Invoice, InvoiceTotals } from "@/types/invoice";
import { InvoiceDocument } from "./InvoiceDocument";

const PT_TO_PX = 96 / 72;
const PAGE_WIDTH_PX = PAGE.width * PT_TO_PX; // ≈ 793.7px

interface Props {
  invoice: Invoice;
  totals: InvoiceTotals;
  pageCount: number;
}

export const InvoicePreview = memo(function InvoicePreview({ invoice, totals, pageCount }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.7);
  const [autoFit, setAutoFit] = useState(true);

  const fit = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const available = el.clientWidth - 48;
    setZoom(Math.min(1.4, Math.max(0.3, available / PAGE_WIDTH_PX)));
  }, []);

  useEffect(() => {
    if (!autoFit) return;
    fit();
    const observer = new ResizeObserver(fit);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [autoFit, fit]);

  const adjust = (delta: number) => {
    setAutoFit(false);
    setZoom((z) => Math.min(2, Math.max(0.3, Number((z + delta).toFixed(2)))));
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Preview chrome — excluded from every export via .no-print + capture target. */}
      <div className="no-print flex items-center justify-between gap-3 border-b border-shell-200 bg-white/80 px-4 py-2 backdrop-blur">
        <p className="text-xs font-medium tracking-wide text-shell-500">
          Live preview · A4 · {pageCount} {pageCount === 1 ? "page" : "pages"}
        </p>
        <div className="flex items-center gap-1">
          <IconButton label="Zoom out" onClick={() => adjust(-0.1)}>
            <Minus className="size-3.5" aria-hidden />
          </IconButton>
          <span className="w-10 text-center text-xs tabular text-shell-500">{Math.round(zoom * 100)}%</span>
          <IconButton label="Zoom in" onClick={() => adjust(0.1)}>
            <Plus className="size-3.5" aria-hidden />
          </IconButton>
          <IconButton
            label="Fit to screen"
            onClick={() => {
              setAutoFit(true);
              fit();
            }}
            active={autoFit}
          >
            <Maximize2 className="size-3.5" aria-hidden />
          </IconButton>
        </div>
      </div>

      <div ref={containerRef} className="invoice-scroll min-h-0 flex-1 overflow-auto bg-shell-100 p-6">
        <div
          style={{
            width: PAGE_WIDTH_PX * zoom,
            margin: "0 auto",
            // Scaling the wrapper keeps text vector-sharp instead of rasterising.
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          <div style={{ width: PAGE_WIDTH_PX, transform: "none" }}>
            {/* The export target. Only invoice artwork lives inside. */}
            <div id="invoice-export-root">
              <InvoiceDocument invoice={invoice} totals={totals} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

function IconButton({
  label,
  onClick,
  children,
  active,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "grid size-7 place-items-center rounded-md border border-shell-200 text-shell-700 transition hover:bg-shell-100",
        active && "border-shell-900 bg-shell-900 text-white hover:bg-shell-900",
      )}
    >
      {children}
    </button>
  );
}
