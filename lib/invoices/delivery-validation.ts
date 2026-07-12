import type { InvoiceSendPreview } from "./delivery-types";
import type { InvoiceStatus, InvoiceWithDetails } from "./types";

const MAX_DELIVERY_MESSAGE_LENGTH = 2000;

const BLOCKED_FINANCIAL_STATUSES: InvoiceStatus[] = ["void"];

export function normalizeDeliveryMessage(message: string | null | undefined): string | null {
  const trimmed = message?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > MAX_DELIVERY_MESSAGE_LENGTH) {
    return trimmed.slice(0, MAX_DELIVERY_MESSAGE_LENGTH);
  }

  return trimmed;
}

export function buildInvoiceSendPreview(
  invoice: InvoiceWithDetails,
): InvoiceSendPreview {
  const customerName =
    invoice.customers?.company || invoice.customers?.name || "Customer";
  const recipientEmail = invoice.customers?.email?.trim() ?? "";

  let blockReason: string | null = null;

  if (BLOCKED_FINANCIAL_STATUSES.includes(invoice.status)) {
    blockReason = "Void invoices cannot be sent.";
  } else if (!recipientEmail) {
    blockReason = "Add an email address to this customer before sending.";
  } else if (invoice.line_items.length === 0) {
    blockReason = "Add at least one line item before sending.";
  } else if (invoice.total_amount <= 0) {
    blockReason = "Invoice total must be greater than zero.";
  }

  return {
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    total_amount: invoice.total_amount,
    balance_due: invoice.balance_due,
    due_date: invoice.due_date,
    customer_name: customerName,
    recipient_email: recipientEmail,
    default_message: invoice.customer_message,
    can_send: blockReason === null,
    block_reason: blockReason,
  };
}

export function mapDeliverySummary(
  delivery: {
    delivery_status: InvoiceSendPreview extends never ? never : string;
    recipient_email: string;
    sent_at: string | null;
    opened_at: string | null;
    delivered_at: string | null;
    failed_at: string | null;
    last_error: string | null;
  } | null,
): import("./delivery-types").InvoiceDeliverySummary {
  if (!delivery) {
    return {
      status: "not_sent",
      recipient_email: null,
      sent_at: null,
      opened_at: null,
      delivered_at: null,
      failed_at: null,
      last_error: null,
    };
  }

  return {
    status: delivery.delivery_status as import("./delivery-types").InvoiceDeliveryStatus,
    recipient_email: delivery.recipient_email,
    sent_at: delivery.sent_at,
    opened_at: delivery.opened_at,
    delivered_at: delivery.delivered_at,
    failed_at: delivery.failed_at,
    last_error: delivery.last_error,
  };
}

export function sanitizePublicInvoicePayload(
  payload: Record<string, unknown> | null,
): import("./delivery-types").PublicInvoiceView | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const lineItemsRaw = payload.line_items;
  const lineItems = Array.isArray(lineItemsRaw)
    ? lineItemsRaw.map((item) => {
        const row = item as Record<string, unknown>;
        return {
          description: String(row.description ?? ""),
          quantity: Number(row.quantity ?? 0),
          unit_price: Number(row.unit_price ?? 0),
          tax_rate: Number(row.tax_rate ?? 0),
          line_total: Number(row.line_total ?? 0),
        };
      })
    : [];

  if (!payload.invoice_number || !payload.business_name) {
    return null;
  }

  return {
    invoice_number: String(payload.invoice_number),
    issue_date: String(payload.issue_date ?? ""),
    due_date: payload.due_date ? String(payload.due_date) : null,
    financial_status: String(payload.financial_status ?? ""),
    subtotal: Number(payload.subtotal ?? 0),
    discount_amount: Number(payload.discount_amount ?? 0),
    tax_amount: Number(payload.tax_amount ?? 0),
    total_amount: Number(payload.total_amount ?? 0),
    amount_paid: Number(payload.amount_paid ?? 0),
    balance_due: Number(payload.balance_due ?? 0),
    customer_message: payload.customer_message
      ? String(payload.customer_message)
      : null,
    business_name: String(payload.business_name),
    business_address: String(payload.business_address ?? ""),
    business_phone: String(payload.business_phone ?? ""),
    business_email: payload.business_email ? String(payload.business_email) : null,
    customer_name: String(payload.customer_name ?? "Customer"),
    line_items: lineItems,
  };
}

export function publicInvoiceContainsSensitiveFields(
  payload: Record<string, unknown>,
): boolean {
  const forbidden = [
    "id",
    "invoice_id",
    "business_profile_id",
    "customer_id",
    "notes",
    "employee_id",
    "payments",
    "token",
    "token_hash",
  ];

  return forbidden.some((key) => key in payload);
}
