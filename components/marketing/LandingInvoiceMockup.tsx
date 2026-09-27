import { createDemoInvoice } from "@/lib/invoice/defaults";
import { calculateInvoiceTotals } from "@/lib/invoice/calculate";
import { formatINR, formatQuantity } from "@/lib/formatting/inr";
import { unscaleQuantity } from "@/lib/money";
import { readableForeground } from "@/lib/brand/contrast";

/** Static server-rendered mockup — same data model, no client JS. */
export function LandingInvoiceMockup() {
  const invoice = createDemoInvoice();
  const totals = calculateInvoiceTotals(invoice);

  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-[24px] bg-gradient-to-br from-shell-100 to-white" aria-hidden />
      <div className="relative overflow-hidden rounded-[18px] border border-shell-200 bg-white shadow-[0_24px_60px_-28px_rgba(0,0,0,0.3)]">
        <div className="h-1.5" style={{ backgroundColor: invoice.brand.accent }} />
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold text-shell-900">{invoice.business.name}</p>
              <p className="text-[10px] text-shell-500">Demo content</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tracking-tight text-shell-900">Invoice</p>
              <p className="mt-1 inline-block rounded-full bg-shell-100 px-2 py-0.5 text-[10px] font-semibold text-shell-700">
                {invoice.number}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-shell-200 pt-4">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-shell-300">Bill to</p>
              <p className="mt-1 text-xs font-semibold text-shell-900">{invoice.client.name}</p>
              <p className="text-[10px] text-shell-500">
                {invoice.client.billingAddress.city}, {invoice.client.billingAddress.state}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-shell-300">Total due</p>
              <p className="mt-1 text-lg font-bold tabular text-shell-900">{formatINR(totals.grandTotalMinor)}</p>
            </div>
          </div>

          <table className="mt-5 w-full text-[10px]">
            <thead>
              <tr className="bg-shell-100 text-[8px] uppercase tracking-widest text-shell-500">
                <th className="px-2 py-1.5 text-left font-semibold">Description</th>
                <th className="px-2 py-1.5 text-right font-semibold">Qty</th>
                <th className="px-2 py-1.5 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={item.id} className="border-b border-shell-100">
                  <td className="px-2 py-2 font-medium text-shell-900">{item.description}</td>
                  <td className="px-2 py-2 text-right tabular text-shell-500">
                    {formatQuantity(unscaleQuantity(item.quantity))}
                  </td>
                  <td className="px-2 py-2 text-right tabular font-semibold text-shell-900">
                    {formatINR(totals.lines[index]?.totalMinor ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex justify-end">
            <div
              className="rounded-md px-3 py-2 text-right"
              style={{ backgroundColor: invoice.brand.accent, color: readableForeground(invoice.brand.accent) }}
            >
              <p className="text-[8px] font-semibold uppercase tracking-widest opacity-80">Total due</p>
              <p className="text-base font-bold tabular">{formatINR(totals.grandTotalMinor)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
