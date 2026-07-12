export const INVOICE_DELIVERY_STATUSES = [
  "not_sent",
  "sent",
  "opened",
  "delivered",
  "failed",
] as const;

export type InvoiceDeliveryStatus = (typeof INVOICE_DELIVERY_STATUSES)[number];

export type InvoiceDelivery = {
  id: string;
  invoice_id: string;
  business_profile_id: string;
  delivery_status: InvoiceDeliveryStatus;
  recipient_email: string;
  message: string | null;
  sent_at: string | null;
  opened_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  last_error: string | null;
  revoked_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type InvoiceDeliverySummary = {
  status: InvoiceDeliveryStatus;
  recipient_email: string | null;
  sent_at: string | null;
  opened_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  last_error: string | null;
};

export type PublicInvoiceLineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  line_total: number;
};

export type PublicInvoiceView = {
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  financial_status: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  customer_message: string | null;
  business_name: string;
  business_address: string;
  business_phone: string;
  business_email: string | null;
  customer_name: string;
  line_items: PublicInvoiceLineItem[];
};

export const DELIVERY_STATUS_LABELS: Record<InvoiceDeliveryStatus, string> = {
  not_sent: "Not sent",
  sent: "Sent",
  opened: "Opened",
  delivered: "Delivered",
  failed: "Failed",
};

export const DELIVERY_STATUS_STYLES: Record<InvoiceDeliveryStatus, string> = {
  not_sent: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  sent: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  opened: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
  delivered: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  failed: "bg-rose-500/10 text-rose-300 border-rose-500/20",
};

export type InvoiceSendPreview = {
  invoice_id: string;
  invoice_number: string;
  total_amount: number;
  balance_due: number;
  due_date: string | null;
  customer_name: string;
  recipient_email: string;
  default_message: string | null;
  can_send: boolean;
  block_reason: string | null;
};
