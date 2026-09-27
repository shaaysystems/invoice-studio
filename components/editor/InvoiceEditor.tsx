"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CloudOff, Eye, Loader2, PencilLine, Save } from "lucide-react";
import { useAutosave } from "@/lib/hooks/use-autosave";
import { saveInvoiceAction } from "@/lib/actions/invoices";
import { localStore } from "@/lib/storage/local";
import { useInvoiceStore, type EditorSection } from "@/lib/store/invoice-store";
import { collectInvoiceIssues } from "@/lib/validation/invoice-schema";
import { Alert, Button, SegmentedControl } from "@/components/ui";
import { InvoicePreview } from "@/components/invoice/InvoicePreview";
import { BrandColorPicker } from "./BrandColorPicker";
import { BusinessForm } from "./BusinessForm";
import { ClientForm } from "./ClientForm";
import { ExportControls } from "./ExportControls";
import { InvoiceDetailsForm } from "./InvoiceDetailsForm";
import { InvoiceItemsEditor } from "./InvoiceItemsEditor";
import { PaymentAndTermsForm } from "./PaymentAndTermsForm";
import { TaxSettings } from "./TaxSettings";
import type { Invoice } from "@/types/invoice";

const SECTIONS: { id: EditorSection; label: string }[] = [
  { id: "parties", label: "Parties" },
  { id: "details", label: "Details" },
  { id: "items", label: "Items" },
  { id: "payment", label: "Payment" },
  { id: "brand", label: "Brand" },
];

export function InvoiceEditor({
  authenticated,
  initialInvoice,
}: {
  authenticated: boolean;
  initialInvoice: Invoice;
}) {
  const invoice = useInvoiceStore((s) => s.invoice);
  const activeSection = useInvoiceStore((s) => s.activeSection);
  const setActiveSection = useInvoiceStore((s) => s.setActiveSection);
  const saveState = useInvoiceStore((s) => s.saveState);
  const load = useInvoiceStore((s) => s.load);
  const setCloudEnabled = useInvoiceStore((s) => s.setCloudEnabled);
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    load(initialInvoice);
    setCloudEnabled(authenticated);
  }, [initialInvoice, load, authenticated, setCloudEnabled]);

  useAutosave(true);

  const totals = useInvoiceStore((s) => s.totals)();
  const pagination = useInvoiceStore((s) => s.pagination)();
  const issues = useMemo(() => collectInvoiceIssues(invoice), [invoice]);

  async function handleSave() {
    if (!authenticated) {
      const stored = localStore.saveInvoice(invoice, "sent");
      setSaveMessage(
        stored
          ? "Saved to this browser. Sign in to sync across devices."
          : "This browser's storage is full. Remove large uploads or sign in to save to the cloud.",
      );
      return;
    }
    const result = await saveInvoiceAction(invoice, "sent");
    setSaveMessage(result.ok ? "Invoice saved." : result.error ?? "We couldn't save this invoice.");
  }

  const preview = <InvoicePreview invoice={invoice} totals={totals} pageCount={pagination.pageCount} />;

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      {/* --------------------------- Editor header --------------------------- */}
      <header className="no-print sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-shell-200 bg-white/90 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-shell-900">
            {invoice.number ? `Invoice ${invoice.number}` : "New invoice"}
          </h1>
          <SaveBadge state={saveState} authenticated={authenticated} />
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={() => void handleSave()}>
            <Save className="size-3.5" aria-hidden />
            Save invoice
          </Button>
          <ExportControls compact />
        </div>
      </header>

      {saveMessage ? (
        <div className="no-print px-4 pt-3">
          <Alert tone="info">{saveMessage}</Alert>
        </div>
      ) : null}

      {/* -------------------------- Mobile tab switch ------------------------ */}
      <div className="no-print flex justify-center border-b border-shell-200 bg-white px-4 py-2 lg:hidden">
        <SegmentedControl
          label="Editor view"
          value={mobileTab}
          onChange={setMobileTab}
          options={[
            { value: "edit", label: "Edit" },
            { value: "preview", label: "Preview" },
          ]}
        />
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(380px,460px)_1fr]">
        {/* ------------------------------ Form ------------------------------ */}
        <div
          className={`invoice-scroll min-h-0 overflow-y-auto border-r border-shell-200 bg-shell-50 ${
            mobileTab === "edit" ? "block" : "hidden"
          } lg:block`}
        >
          <nav aria-label="Editor sections" className="sticky top-0 z-10 border-b border-shell-200 bg-shell-50/95 px-4 py-2.5 backdrop-blur">
            <ul className="flex gap-1 overflow-x-auto">
              {SECTIONS.map((section) => (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    aria-current={activeSection === section.id ? "step" : undefined}
                    className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                      activeSection === section.id ? "bg-shell-900 text-white" : "text-shell-500 hover:bg-shell-200"
                    }`}
                  >
                    {section.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* All sections stay mounted so nothing is lost when switching. */}
          <div className="space-y-4 p-4 pb-28">
            <Panel active={activeSection === "parties"}>
              <BusinessForm authenticated={authenticated} />
              <ClientForm />
            </Panel>
            <Panel active={activeSection === "details"}>
              <InvoiceDetailsForm />
            </Panel>
            <Panel active={activeSection === "items"}>
              <InvoiceItemsEditor />
              <TaxSettings />
            </Panel>
            <Panel active={activeSection === "payment"}>
              <PaymentAndTermsForm authenticated={authenticated} />
            </Panel>
            <Panel active={activeSection === "brand"}>
              <BrandColorPicker />
            </Panel>

            {issues.length > 0 ? (
              <Alert tone="warning" title="Before you export">
                <ul className="mt-1 space-y-0.5">
                  {issues.slice(0, 5).map((issue, index) => (
                    <li key={index}>
                      <strong>{issue.label}:</strong> {issue.message}
                    </li>
                  ))}
                </ul>
              </Alert>
            ) : null}
          </div>
        </div>

        {/* ---------------------------- Preview ---------------------------- */}
        <div className={`min-h-0 ${mobileTab === "preview" ? "block" : "hidden"} lg:block`}>{preview}</div>
      </div>

      {/* Sticky mobile action bar. */}
      <div className="no-print fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-2 border-t border-shell-200 bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setMobileTab(mobileTab === "edit" ? "preview" : "edit")}
        >
          {mobileTab === "edit" ? <Eye className="size-3.5" aria-hidden /> : <PencilLine className="size-3.5" aria-hidden />}
          {mobileTab === "edit" ? "Preview" : "Edit"}
        </Button>
        <ExportControls compact />
      </div>
    </div>
  );
}

function Panel({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div hidden={!active} className="space-y-4">
      {children}
    </div>
  );
}

function SaveBadge({ state, authenticated }: { state: string; authenticated: boolean }) {
  const map: Record<string, { text: string; icon: React.ReactNode }> = {
    idle: {
      text: authenticated ? "All changes saved" : "Saved in this browser",
      icon: <Check className="size-3" aria-hidden />,
    },
    dirty: { text: "Unsaved changes", icon: <PencilLine className="size-3" aria-hidden /> },
    saving: { text: "Saving…", icon: <Loader2 className="size-3 animate-spin" aria-hidden /> },
    saved: { text: authenticated ? "Saved" : "Saved locally", icon: <Check className="size-3" aria-hidden /> },
    error: { text: "Couldn't save", icon: <CloudOff className="size-3" aria-hidden /> },
  };
  const current = map[state] ?? map.idle;
  return (
    <span aria-live="polite" className="flex items-center gap-1 text-[11px] text-shell-500">
      {current!.icon}
      {current!.text}
    </span>
  );
}
