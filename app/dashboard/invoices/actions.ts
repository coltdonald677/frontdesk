"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getBusinessProfile } from "@/lib/business-profile";
import type { CreateInvoiceInput, InvoiceLineItemInput } from "@/lib/invoices";
import {
  buildInvoiceDraftFromAppointment,
  createInvoice,
  duplicateInvoice,
  getActiveInvoiceForAppointment,
  getInvoiceById,
  recordInvoicePayment,
  updateInvoice,
  updateInvoiceStatus,
} from "@/lib/invoices";
import {
  notifyInvoiceCreated,
  notifyInvoiceOverdue,
  notifyInvoicePaid,
  notifyPaymentRecorded,
} from "@/lib/notifications/invoice-events";

export type InvoiceActionState = {
  error?: string;
  success?: boolean;
  message?: string;
  invoiceId?: string;
};

async function getBusinessContext() {
  const profile = await getBusinessProfile();
  if (!profile) {
    redirect("/onboarding");
  }
  return profile;
}

function revalidateInvoicePaths(invoiceId?: string, customerId?: string) {
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
  if (invoiceId) {
    revalidatePath(`/dashboard/invoices/${invoiceId}`);
    revalidatePath(`/dashboard/invoices/${invoiceId}/print`);
  }
  if (customerId) {
    revalidatePath(`/dashboard/customers/${customerId}`);
  }
}

function parseLineItems(formData: FormData): InvoiceLineItemInput[] {
  const raw = formData.get("line_items");
  if (typeof raw !== "string" || !raw.trim()) {
    return [];
  }

  const parsed = JSON.parse(raw) as InvoiceLineItemInput[];
  return parsed.map((item, index) => ({
    description: String(item.description ?? ""),
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    tax_rate: Number(item.tax_rate ?? 0),
    sort_order: item.sort_order ?? index,
  }));
}

function parseInvoiceInput(formData: FormData): CreateInvoiceInput {
  const customerId = String(formData.get("customer_id") ?? "");
  const appointmentId = formData.get("appointment_id");
  const discountRaw = formData.get("discount_amount");

  return {
    customer_id: customerId,
    appointment_id:
      typeof appointmentId === "string" && appointmentId ? appointmentId : null,
    issue_date: String(formData.get("issue_date") ?? ""),
    due_date: String(formData.get("due_date") ?? "") || null,
    discount_amount: discountRaw ? Number(discountRaw) : 0,
    notes: String(formData.get("notes") ?? "") || null,
    customer_message: String(formData.get("customer_message") ?? "") || null,
    line_items: parseLineItems(formData),
    status: "draft",
  };
}

export async function createInvoiceAction(
  _prev: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  try {
    const profile = await getBusinessContext();
    const input = parseInvoiceInput(formData);
    const forceDuplicate = formData.get("force_duplicate") === "true";

    if (!input.customer_id) {
      return { error: "Select a customer." };
    }

    if (input.appointment_id && !forceDuplicate) {
      const existing = await getActiveInvoiceForAppointment(
        profile.id,
        input.appointment_id,
      );
      if (existing) {
        return {
          error: `An active invoice (${existing.invoice_number}) already exists for this appointment.`,
        };
      }
    }

    const invoice = await createInvoice(profile.id, input);
    await notifyInvoiceCreated(profile.id, invoice);
    revalidateInvoicePaths(invoice.id, invoice.customer_id);

    return {
      success: true,
      message: "Invoice created.",
      invoiceId: invoice.id,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create invoice.",
    };
  }
}

export async function updateInvoiceAction(
  _prev: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  try {
    const profile = await getBusinessContext();
    const invoiceId = String(formData.get("invoice_id") ?? "");
    const force = formData.get("force_edit") === "true";
    const input = parseInvoiceInput(formData);

    if (!invoiceId) {
      return { error: "Invoice not found." };
    }

    const invoice = await updateInvoice(
      profile.id,
      { ...input, id: invoiceId },
      { force },
    );
    revalidateInvoicePaths(invoice.id, invoice.customer_id);

    return {
      success: true,
      message: "Invoice updated.",
      invoiceId: invoice.id,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to update invoice.",
    };
  }
}

export async function markInvoiceSentAction(
  invoiceId: string,
): Promise<InvoiceActionState> {
  try {
    const profile = await getBusinessContext();
    const invoice = await updateInvoiceStatus(profile.id, invoiceId, "sent");
    revalidateInvoicePaths(invoice.id, invoice.customer_id);
    return { success: true, message: "Invoice marked as sent." };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to update invoice.",
    };
  }
}

export async function markInvoiceViewedAction(
  invoiceId: string,
): Promise<InvoiceActionState> {
  try {
    const profile = await getBusinessContext();
    const existing = await getInvoiceById(profile.id, invoiceId);
    if (!existing || existing.status === "draft" || existing.status === "void") {
      return { error: "Invoice cannot be marked viewed." };
    }
    const invoice = await updateInvoiceStatus(profile.id, invoiceId, "viewed");
    revalidateInvoicePaths(invoice.id, invoice.customer_id);
    return { success: true, message: "Invoice marked as viewed." };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to update invoice.",
    };
  }
}

export async function voidInvoiceAction(
  invoiceId: string,
): Promise<InvoiceActionState> {
  try {
    const profile = await getBusinessContext();
    const invoice = await updateInvoiceStatus(profile.id, invoiceId, "void");
    revalidateInvoicePaths(invoice.id, invoice.customer_id);
    return { success: true, message: "Invoice voided." };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to void invoice.",
    };
  }
}

export async function markInvoicePaidAction(
  invoiceId: string,
): Promise<InvoiceActionState> {
  try {
    const profile = await getBusinessContext();
    const existing = await getInvoiceById(profile.id, invoiceId);
    if (!existing) {
      return { error: "Invoice not found." };
    }

    if (existing.balance_due <= 0) {
      const invoice = await updateInvoiceStatus(profile.id, invoiceId, "paid");
      revalidateInvoicePaths(invoice.id, invoice.customer_id);
      return { success: true, message: "Invoice marked as paid." };
    }

    const invoice = await recordInvoicePayment(profile.id, {
      invoice_id: invoiceId,
      amount: existing.balance_due,
      payment_date: new Date().toISOString().slice(0, 10),
      note: "Marked paid in full",
    });

    await notifyInvoicePaid(profile.id, invoice);
    revalidateInvoicePaths(invoice.id, invoice.customer_id);
    return { success: true, message: "Invoice marked as paid." };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to mark invoice paid.",
    };
  }
}

export async function recordPaymentAction(
  _prev: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  try {
    const profile = await getBusinessContext();
    const invoiceId = String(formData.get("invoice_id") ?? "");
    const amount = Number(formData.get("amount"));
    const paymentDate = String(formData.get("payment_date") ?? "");
    const note = String(formData.get("note") ?? "") || null;

    const invoice = await recordInvoicePayment(profile.id, {
      invoice_id: invoiceId,
      amount,
      payment_date: paymentDate,
      note,
    });

    await notifyPaymentRecorded(profile.id, invoice, amount);
    if (invoice.status === "paid") {
      await notifyInvoicePaid(profile.id, invoice);
    }

    revalidateInvoicePaths(invoice.id, invoice.customer_id);
    return { success: true, message: "Payment recorded.", invoiceId: invoice.id };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to record payment.",
    };
  }
}

export async function duplicateInvoiceAction(
  invoiceId: string,
): Promise<InvoiceActionState> {
  try {
    const profile = await getBusinessContext();
    const invoice = await duplicateInvoice(profile.id, invoiceId);
    await notifyInvoiceCreated(profile.id, invoice);
    revalidateInvoicePaths(invoice.id, invoice.customer_id);
    return {
      success: true,
      message: "Invoice duplicated as draft.",
      invoiceId: invoice.id,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to duplicate invoice.",
    };
  }
}

export async function loadInvoiceDraftFromAppointmentAction(
  appointmentId: string,
): Promise<{ draft: CreateInvoiceInput | null; existingInvoiceNumber?: string; error?: string }> {
  try {
    const profile = await getBusinessContext();
    const existing = await getActiveInvoiceForAppointment(profile.id, appointmentId);
    if (existing) {
      return {
        draft: null,
        existingInvoiceNumber: existing.invoice_number,
      };
    }

    const draftResult = await buildInvoiceDraftFromAppointment(profile.id, appointmentId);
    return { draft: draftResult?.input ?? null };
  } catch (err) {
    return {
      draft: null,
      error: err instanceof Error ? err.message : "Failed to load appointment.",
    };
  }
}

export async function syncOverdueInvoiceNotificationsAction(): Promise<void> {
  try {
    const profile = await getBusinessContext();
    const { syncOverdueInvoices, getInvoices } = await import("@/lib/invoices");
    await syncOverdueInvoices(profile.id);
    const overdue = await getInvoices(profile.id, { filter: "overdue", limit: 20 });
    for (const invoice of overdue) {
      await notifyInvoiceOverdue(profile.id, invoice);
    }
  } catch {
    // Non-blocking dashboard sync
  }
}
