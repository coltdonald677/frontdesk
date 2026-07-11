import "server-only";

import { invoicesLink } from "@/lib/dashboard/links";
import type { InvoiceWithCustomer, InvoiceWithDetails } from "@/lib/invoices";
import { createNotification } from "./service";

export async function notifyInvoiceCreated(
  businessProfileId: string,
  invoice: InvoiceWithCustomer | InvoiceWithDetails,
) {
  const customerName =
    invoice.customers?.company || invoice.customers?.name || "a customer";

  await createNotification({
    businessProfileId,
    type: "invoice.created",
    severity: "info",
    title: "Invoice created",
    description: `${invoice.invoice_number} for ${customerName} (${invoice.status}).`,
    actionLabel: "View invoice",
    actionHref: invoicesLink({ invoiceId: invoice.id }),
    relatedEntityType: "invoice",
    relatedEntityId: invoice.id,
    source: "system",
    dedupeEntityId: `${invoice.id}:created`,
  });
}

export async function notifyInvoiceOverdue(
  businessProfileId: string,
  invoice: InvoiceWithCustomer,
) {
  const customerName =
    invoice.customers?.company || invoice.customers?.name || "a customer";

  await createNotification({
    businessProfileId,
    type: "invoice.overdue",
    severity: "warning",
    title: "Invoice overdue",
    description: `${invoice.invoice_number} for ${customerName} is past due with ${invoice.balance_due.toFixed(2)} outstanding.`,
    actionLabel: "View invoice",
    actionHref: invoicesLink({ invoiceId: invoice.id }),
    relatedEntityType: "invoice",
    relatedEntityId: invoice.id,
    source: "system",
    dedupe: true,
    dedupeEntityId: invoice.id,
  });
}

export async function notifyPaymentRecorded(
  businessProfileId: string,
  invoice: InvoiceWithDetails,
  amount: number,
) {
  await createNotification({
    businessProfileId,
    type: "invoice.payment_recorded",
    severity: "success",
    title: "Payment recorded",
    description: `$${amount.toFixed(2)} recorded on ${invoice.invoice_number}.`,
    actionLabel: "View invoice",
    actionHref: invoicesLink({ invoiceId: invoice.id }),
    relatedEntityType: "invoice",
    relatedEntityId: invoice.id,
    source: "system",
    dedupe: false,
  });
}

export async function notifyInvoicePaid(
  businessProfileId: string,
  invoice: InvoiceWithDetails,
) {
  const customerName =
    invoice.customers?.company || invoice.customers?.name || "a customer";

  await createNotification({
    businessProfileId,
    type: "invoice.paid",
    severity: "success",
    title: "Invoice paid",
    description: `${invoice.invoice_number} for ${customerName} is fully paid.`,
    actionLabel: "View invoice",
    actionHref: invoicesLink({ invoiceId: invoice.id }),
    relatedEntityType: "invoice",
    relatedEntityId: invoice.id,
    source: "system",
    dedupe: true,
    dedupeEntityId: `${invoice.id}:paid`,
  });
}
