"use server";

import { revalidatePath } from "next/cache";
import { calculateInvoiceTotals } from "@/lib/invoice/calculate";
import { normalizeInvoice } from "@/lib/invoice/normalize";
import { collectInvoiceIssues, invoiceSchema } from "@/lib/validation/invoice-schema";
import { createServerSupabase, requireUser } from "@/lib/supabase/server";
import type { Invoice, InvoiceListRow } from "@/types/invoice";

export interface ActionResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
  issues?: { label: string; message: string }[];
}

export type InvoiceStatus = InvoiceListRow["status"];

/** Stored separately from the document, because `Invoice` has no status field. */
export interface InvoiceRecord {
  invoice: Invoice;
  status: InvoiceStatus;
}

interface InvoiceRow {
  id: string;
  status: string;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  currency: string;
  tax_mode: string;
  grand_total_minor: number;
  updated_at: string;
  payload: Invoice;
}

function rowToRecord(row: InvoiceRow): InvoiceRecord | null {
  // The payload is authoritative; scalars are a denormalized cache for lists.
  const invoice = normalizeInvoice(row.payload);
  if (!invoice) return null;
  const merged: Invoice = {
    ...invoice,
    id: row.id,
    number: row.invoice_number,
    issueDate: row.issue_date,
    dueDate: row.due_date ?? invoice.dueDate ?? "",
  };

  const status = row.status;
  return {
    invoice: merged,
    status: status === "sent" || status === "paid" ? status : "draft",
  };
}

function recordToRow(
  userId: string,
  invoice: Invoice,
  status: InvoiceStatus,
  businessProfileId: string | null,
) {
  // Totals are recomputed server-side — the client is never the source of truth.
  const totals = calculateInvoiceTotals(invoice);
  const discountMinor = totals.lineDiscountMinor + totals.globalDiscountMinor;

  return {
    id: invoice.id,
    user_id: userId,
    business_profile_id: businessProfileId,
    invoice_number: invoice.number,
    issue_date: invoice.issueDate,
    due_date: invoice.dueDate || null,
    currency: invoice.currency,
    status,
    tax_mode: invoice.taxMode,
    schema_version: 1,
    subtotal_minor: totals.subtotalMinor,
    discount_minor: discountMinor,
    total_tax_minor: totals.taxMinor,
    shipping_minor: totals.shippingMinor,
    grand_total_minor: totals.grandTotalMinor,
    payload: invoice,
  };
}

export async function saveInvoiceAction(
  input: Invoice,
  status: InvoiceStatus = "draft",
  businessProfileId: string | null = null,
): Promise<ActionResult<{ id: string }>> {
  const issues = collectInvoiceIssues(input);
  if (issues.length > 0) {
    return { ok: false, error: "Please fix the highlighted fields.", issues };
  }

  const parsed = invoiceSchema.parse(input);

  try {
    const user = await requireUser();
    const supabase = await createServerSupabase();
    if (!supabase) return { ok: false, error: "Cloud saving is not available." };

    const { error: upsertError } = await supabase
      .from("invoices")
      .upsert(recordToRow(user.id, parsed as Invoice, status, businessProfileId), { onConflict: "id" });
    if (upsertError) throw upsertError;

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/invoices");
    return { ok: true, data: { id: parsed.id } };
  } catch (error) {
    // Never log invoice bodies — they contain client PII and bank details.
    console.error("[saveInvoice]", { invoiceId: parsed.id, message: (error as Error).message });
    if ((error as Error).message === "UNAUTHENTICATED") {
      return { ok: false, error: "Your session expired. Sign in again to save to the cloud." };
    }
    return { ok: false, error: "We couldn't save this invoice. Please try again." };
  }
}

export async function fetchInvoicesAction(): Promise<ActionResult<InvoiceRecord[]>> {
  try {
    const user = await requireUser();
    const supabase = await createServerSupabase();
    if (!supabase) return { ok: true, data: [] };

    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    return { ok: true, data: (data ?? []).map(rowToRecord).filter((entry): entry is InvoiceRecord => entry !== null) };
  } catch (error) {
    if ((error as Error).message === "UNAUTHENTICATED") return { ok: true, data: [] };
    console.error("[fetchInvoices]", (error as Error).message);
    return { ok: false, error: "We couldn't load your invoices." };
  }
}

export async function fetchInvoiceAction(id: string): Promise<ActionResult<InvoiceRecord>> {
  try {
    const user = await requireUser();
    const supabase = await createServerSupabase();
    if (!supabase) return { ok: false, error: "Not available." };

    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id) // defence in depth alongside RLS
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, error: "That invoice could not be found." };

    const record = rowToRecord(data as unknown as InvoiceRow);
    if (!record) return { ok: false, error: "That invoice could not be read." };

    return { ok: true, data: record };
  } catch (error) {
    console.error("[fetchInvoice]", { id, message: (error as Error).message });
    return { ok: false, error: "We couldn't load that invoice." };
  }
}

export async function updateInvoiceStatusAction(
  id: string,
  status: InvoiceStatus,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const supabase = await createServerSupabase();
    if (!supabase) return { ok: false, error: "Not available." };

    const { error } = await supabase
      .from("invoices")
      .update({ status })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/invoices");
    return { ok: true };
  } catch (error) {
    console.error("[updateInvoiceStatus]", { id, message: (error as Error).message });
    return { ok: false, error: "We couldn't update that invoice." };
  }
}

export async function deleteInvoiceAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const supabase = await createServerSupabase();
    if (!supabase) return { ok: false, error: "Not available." };

    const { error } = await supabase.from("invoices").delete().eq("id", id).eq("user_id", user.id);
    if (error) throw error;

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/invoices");
    return { ok: true };
  } catch (error) {
    console.error("[deleteInvoice]", { id, message: (error as Error).message });
    return { ok: false, error: "We couldn't delete that invoice." };
  }
}

/**
 * Reserves the next invoice number server-side so two sessions cannot claim
 * the same sequence. The counter advance happens in the same call, which is
 * safe because the per-business unique index is the real guard.
 */
export async function reserveInvoiceNumberAction(
  businessProfileId: string,
): Promise<ActionResult<{ number: string; nextSequence: number }>> {
  try {
    const user = await requireUser();
    const supabase = await createServerSupabase();
    if (!supabase) return { ok: false, error: "Not available." };

    const { data: profile, error: readError } = await supabase
      .from("business_profiles")
      .select("payload")
      .eq("id", businessProfileId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (readError) throw readError;
    if (!profile) return { ok: false, error: "Business profile not found." };

    const { rollNumberingIfYearChanged, generateInvoiceNumber, numberingConfigFromProfile } = await import(
      "@/lib/invoice/numbering"
    );
    const numbering = (profile as { payload?: { numbering?: Parameters<typeof numberingConfigFromProfile>[0] } })
      .payload?.numbering;
    if (!numbering) return { ok: false, error: "This profile has no numbering settings." };

    const { numbering: rolled } = rollNumberingIfYearChanged(numbering);
    const config = numberingConfigFromProfile(rolled);
    const number = generateInvoiceNumber(config);

    const { error: writeError } = await supabase
      .from("business_profiles")
      .update({
        payload: {
          ...(profile as { payload: Record<string, unknown> }).payload,
          numbering: { ...rolled, nextSequence: config.nextSequence + 1 },
        },
      })
      .eq("id", businessProfileId)
      .eq("user_id", user.id);
    if (writeError) throw writeError;

    return { ok: true, data: { number, nextSequence: config.nextSequence + 1 } };
  } catch (error) {
    console.error("[reserveInvoiceNumber]", (error as Error).message);
    return { ok: false, error: "We couldn't generate an invoice number." };
  }
}
