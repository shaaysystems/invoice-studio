"use client";

import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { formatINR } from "@/lib/formatting/inr";
import { UNIT_OPTIONS } from "@/lib/invoice/defaults";
import { minorToInputValue, rupeesToMinor, scaleQuantity, unscaleQuantity } from "@/lib/money";
import { useInvoiceStore } from "@/lib/store/invoice-store";
import { Button, Field, Input, SectionCard, Select, Textarea } from "@/components/ui";

export function InvoiceItemsEditor() {
  const items = useInvoiceStore((s) => s.invoice.items);
  const taxMode = useInvoiceStore((s) => s.invoice.taxMode);
  const totalsFn = useInvoiceStore((s) => s.totals);
  const { addItem, updateItem, removeItem, duplicateItem, moveItem } = useInvoiceStore.getState();
  const totals = totalsFn();
  const gst = taxMode === "gst";

  return (
    <SectionCard
      title="Items"
      description="Add as many line items as you need. Long descriptions wrap and paginate automatically."
      action={
        <Button type="button" variant="primary" size="sm" onClick={addItem}>
          <Plus className="size-3.5" aria-hidden />
          Add item
        </Button>
      }
    >
      <ul className="space-y-3">
        {items.map((item, index) => {
          const line = totals.lines[index];
          const isCustomUnit = item.unit !== "" && !UNIT_OPTIONS.includes(item.unit as never);
          const quantityValue = item.quantity === 0 ? "" : String(unscaleQuantity(item.quantity));

          return (
            <li key={item.id} className="rounded-lg border border-shell-200 bg-shell-50/50 p-3">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wide text-shell-500">
                  ITEM {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex items-center gap-0.5">
                  <IconAction label="Move up" disabled={index === 0} onClick={() => moveItem(item.id, -1)}>
                    <ArrowUp className="size-3.5" aria-hidden />
                  </IconAction>
                  <IconAction
                    label="Move down"
                    disabled={index === items.length - 1}
                    onClick={() => moveItem(item.id, 1)}
                  >
                    <ArrowDown className="size-3.5" aria-hidden />
                  </IconAction>
                  <IconAction label="Duplicate item" onClick={() => duplicateItem(item.id)}>
                    <Copy className="size-3.5" aria-hidden />
                  </IconAction>
                  <IconAction label="Delete item" onClick={() => removeItem(item.id)} danger>
                    <Trash2 className="size-3.5" aria-hidden />
                  </IconAction>
                </div>
              </div>

              <div className="space-y-3">
                <Field label="Description">
                  {(p) => (
                    <Textarea
                      {...p}
                      rows={2}
                      value={item.description}
                      onChange={(e) => updateItem(item.id, { description: e.target.value })}
                      placeholder="Brand identity design — what's included in this line item."
                    />
                  )}
                </Field>

                <div className="grid gap-3 sm:grid-cols-4">
                  <Field label="Quantity">
                    {(p) => (
                      <Input
                        {...p}
                        type="number"
                        min="0"
                        step="0.001"
                        value={quantityValue}
                        onChange={(e) => updateItem(item.id, { quantity: scaleQuantity(Number(e.target.value) || 0) })}
                      />
                    )}
                  </Field>

                  <Field label="Unit">
                    {(p) => (
                      <Select
                        {...p}
                        value={isCustomUnit ? "custom" : item.unit}
                        onChange={(e) =>
                          updateItem(item.id, { unit: e.target.value === "custom" ? "" : e.target.value })
                        }
                      >
                        {UNIT_OPTIONS.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                        <option value="custom">Custom…</option>
                      </Select>
                    )}
                  </Field>

                  <Field label="Rate (₹)">
                    {(p) => (
                      <Input
                        {...p}
                        type="number"
                        min="0"
                        step="0.01"
                        value={minorToInputValue(item.rateMinor)}
                        onChange={(e) => updateItem(item.id, { rateMinor: rupeesToMinor(e.target.value) })}
                      />
                    )}
                  </Field>

                  <Field label="Line total">
                    {(p) => (
                      <div
                        {...p}
                        aria-readonly
                        className="flex h-10 items-center justify-end rounded-lg border border-shell-200 bg-white px-3 text-sm font-semibold tabular text-shell-900"
                      >
                        {formatINR(line?.totalMinor ?? 0)}
                      </div>
                    )}
                  </Field>
                </div>

                {isCustomUnit || item.unit === "" ? (
                  <Field label="Custom unit" optional>
                    {(p) => (
                      <Input
                        {...p}
                        value={item.unit}
                        onChange={(e) => updateItem(item.id, { unit: e.target.value })}
                        placeholder="sessions"
                      />
                    )}
                  </Field>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Line discount" optional>
                    {(p) => (
                      <div className="flex gap-2">
                        <Select
                          value={item.discountType}
                          aria-label={`Discount type for item ${index + 1}`}
                          className="w-28"
                          onChange={(e) =>
                            updateItem(item.id, {
                              discountType: e.target.value as typeof item.discountType,
                              // A type change invalidates the previous value's meaning.
                              discountValue: 0,
                            })
                          }
                        >
                          <option value="none">None</option>
                          <option value="percent">Percent</option>
                          <option value="amount">Amount (₹)</option>
                        </Select>
                        <Input
                          {...p}
                          type="number"
                          min="0"
                          step={item.discountType === "percent" ? "0.01" : "0.01"}
                          disabled={item.discountType === "none"}
                          value={item.discountType === "none" ? "" : String(item.discountValue)}
                          onChange={(e) => updateItem(item.id, { discountValue: Number(e.target.value) || 0 })}
                        />
                      </div>
                    )}
                  </Field>

                  {gst ? (
                    <Field label="GST rate (%)" optional hint={`Set per item. Leave 0 for no tax on this line.`}>
                      {(p) => (
                        <Input
                          {...p}
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={String(item.taxRate)}
                          onChange={(e) => updateItem(item.id, { taxRate: Number(e.target.value) || 0 })}
                        />
                      )}
                    </Field>
                  ) : null}
                </div>

                {gst ? (
                  <Field label="HSN / SAC" optional>
                    {(p) => (
                      <Input
                        {...p}
                        value={item.hsn}
                        onChange={(e) => updateItem(item.id, { hsn: e.target.value })}
                        placeholder="998311"
                      />
                    )}
                  </Field>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between rounded-lg bg-shell-100 px-3 py-2.5">
        <span className="text-xs font-medium text-shell-700">Items subtotal</span>
        <span className="text-sm font-semibold tabular text-shell-900">{formatINR(totals.subtotalMinor)}</span>
      </div>
    </SectionCard>
  );
}

function IconAction({
  label,
  onClick,
  children,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid size-7 place-items-center rounded-md transition disabled:opacity-30 ${
        danger ? "text-red-600 hover:bg-red-50" : "text-shell-500 hover:bg-shell-200 hover:text-shell-900"
      }`}
    >
      {children}
    </button>
  );
}
