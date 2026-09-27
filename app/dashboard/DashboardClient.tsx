// app/dashboard/DashboardClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy, FileDown, Image as ImageIcon, PencilLine, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { deleteInvoiceAction, saveInvoiceAction, type InvoiceRecord } from "@/lib/actions/invoices";
import { calculateInvoiceTotals } from "@/lib/invoice/calculate";
import { duplicateInvoice } from "@/lib/invoice/snapshot";
import { exportInvoiceJpeg, exportInvoicePdf } from "@/lib/export/export-invoice";
import { formatINR, formatInvoiceDate, todayISO, addDaysISO } from "@/lib/formatting/inr";
import { localStore } from "@/lib/storage/local";
import { newId } from "@/lib/invoice/defaults";
import { Alert, EmptyState, Input, Select } from "@/components/ui";
import { InvoiceDocument } from "@/components/invoice/InvoiceDocument";
import type { Invoice } from "@/types/invoice";

type StatusFilter = "all" | "draft" | "sent" | "paid";

const STATUS_META: Record<Exclude<StatusFilter, "all">, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-shell-100 text-shell-500" },
  sent: { label: "Sent", className: "bg-blue-50 text-blue-700" },
  paid: { label: "Paid", className: "bg-emerald-50 text-emerald-700" },
};

export function DashboardClient({
  authenticated,
  cloudInvoices,
}: {
  authenticated: boolean;
  cloudInvoices: InvoiceRecord[];
}) {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(cloudInvoices);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [notice, setNotice] = useState<string | null>(null);
  // Hidden render target so exports work directly from the list.
  const [exportTarget, setExportTarget] = useState<Invoice | null>(null);

  useEffect(() => {
    if (authenticated) return;
    setInvoices(
      localStore.listInvoices().map((entry) => ({ invoice: entry.invoice, status: entry.status })),
    );
  }, [authenticated]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invoices.filter((record) => {
      if (status !== "all" && record.status !== status) return false;
      if (!q) return true;
      return [record.invoice.number, record.invoice.client.name, record.invoice.business.name]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [invoices, query, status]);

  const stats = useMemo(
    () => ({
      total: invoices.length,
      drafts: invoices.filter((i) => i.status === "draft").length,
      value: invoices.reduce(
        (sum, i) => sum + calculateInvoiceTotals(i.invoice).grandTotalMinor,
        0,
      ),
    }),
    [invoices],
  );

  async function handleDuplicate(record: InvoiceRecord) {
    const copy = duplicateInvoice(record.invoice, {
      id: newId(),
      number: `${record.invoice.number}-COPY`,
      issueDate: todayISO(),
      dueDate: addDaysISO(todayISO(), 7),
    });
    if (authenticated) {
      const result = await saveInvoiceAction(copy, "draft");
      if (!result.ok) {
        setNotice(result.error ?? "We couldn't duplicate that invoice.");
        return;
      }
    } else {
      localStore.saveInvoice(copy, "draft");
    }
    setInvoices((prev) => [{ invoice: copy, status: "draft" }, ...prev]);
    setNotice(`Duplicated as ${copy.number}. The original is unchanged.`);
  }

  async function handleDelete(record: InvoiceRecord) {
    if (authenticated) {
      const result = await deleteInvoiceAction(record.invoice.id);
      if (!result.ok) {
        setNotice(result.error ?? "We couldn't delete that invoice.");
        return;
      }
    } else {
      localStore.deleteInvoice(record.invoice.id);
    }
    setInvoices((prev) => prev.filter((i) => i.invoice.id !== record.invoice.id));
  }

  async function handleExport(invoice: Invoice, kind: "pdf" | "jpeg") {
    if (kind === "pdf") {
      const result = await exportInvoicePdf(invoice);
      if (!result.ok) setNotice(result.error ?? "Export failed.");
      return;
    }
    // JPEG needs the invoice in the DOM — mount it offscreen, capture, unmount.
    setExportTarget(invoice);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const result = await exportInvoiceJpeg(invoice);
    setExportTarget(null);
    if (!result.ok) setNotice(result.error ?? "Export failed.");
  }

  return (
    <AppShell authenticated={authenticated}>
      <div className="px-6 py-8">
        <p className="text-xs text-shell-500">{greeting}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-shell-900">Create a new invoice</h1>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href="/invoices/new"
            className="inline-flex items-center gap-2 rounded-lg bg-shell-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-shell-700"
          >
            <Plus className="size-4" aria-hidden />
            New Invoice
          </Link>
          <Link
            href="/dashboard/business"
            className="rounded-lg border border-shell-200 bg-white px-4 py-2.5 text-sm font-medium text-shell-900 hover:bg-shell-100"
          >
            Business Profile
          </Link>
          <Link
            href="/dashboard/invoices"
            className="rounded-lg border border-shell-200 bg-white px-4 py-2.5 text-sm font-medium text-shell-900 hover:bg-shell-100"
          >
            Saved Invoices
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ["Total invoices", String(stats.total)],
            ["Drafts", String(stats.drafts)],
            ["Invoiced value", formatINR(stats.value, { compactDecimals: true })],
          ].map(([label, value]) => (
            <div key={label} className="rounded-panel border border-shell-200 bg-white p-5">
              <p className="text-[11px] uppercase tracking-widest text-shell-500">{label}</p>
              <p className="mt-1.5 text-xl font-semibold tabular text-shell-900">{value}</p>
            </div>
          ))}
        </div>

        {notice ? (
          <div className="mt-6">
            <Alert tone="info">{notice}</Alert>
          </div>
        ) : null}

        <section className="mt-10">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-shell-900">Recent invoices</h2>
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search number, client or business"
                aria-label="Search invoices"
                className="w-64"
              />
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusFilter)}
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
              </Select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title={invoices.length === 0 ? "No invoices yet" : "No invoices match your search"}
              description={
                invoices.length === 0
                  ? "Create your first invoice and make your business paperwork look professional."
                  : "Try a different invoice number, client name or status."
              }
              action={
                invoices.length === 0 ? (
                  <Link
                    href="/invoices/new"
                    className="rounded-lg bg-shell-900 px-4 py-2 text-sm font-medium text-white"
                  >
                    Create Invoice
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <ul className="space-y-2">
              {filtered.map((record) => {
                const invoice = record.invoice;
                const totals = calculateInvoiceTotals(invoice);
                const meta = STATUS_META[record.status];
                return (
                  <li key={invoice.id} className="rounded-panel border border-shell-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-shell-900">
                            {invoice.number || "Untitled"}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.className}`}
                          >
                            {meta.label}
                          </span>
                        </div>
                        <p className="truncate text-xs text-shell-500">
                          {invoice.client.name || "No client"} ·{" "}
                          {formatInvoiceDate(invoice.issueDate, "short")}
                          {invoice.dueDate ? ` · due ${formatInvoiceDate(invoice.dueDate, "short")}` : ""}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <p className="text-sm font-semibold tabular text-shell-900">
                          {formatINR(totals.grandTotalMinor)}
                        </p>
                        <div className="flex items-center gap-0.5">
                          <Link
                            href={`/invoices/${invoice.id}`}
                            aria-label={`Edit invoice ${invoice.number}`}
                            title="Edit"
                            className="grid size-8 place-items-center rounded-md text-shell-500 hover:bg-shell-100 hover:text-shell-900"
                          >
                            <PencilLine className="size-3.5" aria-hidden />
                          </Link>
                          <ActionButton label="Duplicate" onClick={() => void handleDuplicate(record)}>
                            <Copy className="size-3.5" aria-hidden />
                          </ActionButton>
                          <ActionButton
                            label="Download PDF"
                            onClick={() => void handleExport(invoice, "pdf")}
                          >
                            <FileDown className="size-3.5" aria-hidden />
                          </ActionButton>
                          <ActionButton
                            label="Download JPEG"
                            onClick={() => void handleExport(invoice, "jpeg")}
                          >
                            <ImageIcon className="size-3.5" aria-hidden />
                          </ActionButton>
                          <ActionButton label="Delete" danger onClick={() => void handleDelete(record)}>
                            <Trash2 className="size-3.5" aria-hidden />
                          </ActionButton>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Offscreen export stage — positioned off-canvas, not display:none,
          so layout is real and modern-screenshot can rasterise it. */}
      {exportTarget ? (
        <div aria-hidden style={{ position: "fixed", left: "-10000px", top: 0 }}>
          <div id="invoice-export-root">
            <InvoiceDocument invoice={exportTarget} />
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function ActionButton({
  label,
  onClick,
  children,
  danger,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid size-8 place-items-center rounded-md transition ${
        danger ? "text-red-600 hover:bg-red-50" : "text-shell-500 hover:bg-shell-100 hover:text-shell-900"
      }`}
    >
      {children}
    </button>
  );
}
