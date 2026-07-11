export const INVOICE_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "partially_paid",
  "paid",
  "overdue",
  "void",
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type InvoiceFilter =
  | "all"
  | "draft"
  | "sent"
  | "overdue"
  | "paid"
  | "void";

export type InvoiceLineItem = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  line_total: number;
  sort_order: number;
  created_at: string;
};

export type InvoicePayment = {
  id: string;
  invoice_id: string;
  business_profile_id: string;
  amount: number;
  payment_date: string;
  note: string | null;
  source: string;
  created_at: string;
};

export type Invoice = {
  id: string;
  business_profile_id: string;
  customer_id: string;
  appointment_id: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  notes: string | null;
  customer_message: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceWithCustomer = Invoice & {
  customers: {
    id: string;
    name: string;
    company: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

export type InvoiceWithDetails = InvoiceWithCustomer & {
  line_items: InvoiceLineItem[];
  payments: InvoicePayment[];
  appointments?: {
    id: string;
    title: string;
    appointment_date: string;
    status: string;
  } | null;
};

export type InvoiceLineItemInput = {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  sort_order?: number;
};

export type CreateInvoiceInput = {
  customer_id: string;
  appointment_id?: string | null;
  issue_date: string;
  due_date?: string | null;
  discount_amount?: number;
  notes?: string | null;
  customer_message?: string | null;
  line_items: InvoiceLineItemInput[];
  status?: InvoiceStatus;
};

export type UpdateInvoiceInput = CreateInvoiceInput & {
  id: string;
};

export type InvoiceAppointmentContext = {
  id: string;
  title: string;
  appointmentDate: string;
  dateLabel: string;
  timeLabel: string;
  customerName: string;
  employeeName: string | null;
};

export type InvoiceDraftFromAppointment = {
  input: CreateInvoiceInput;
  appointment: InvoiceAppointmentContext;
};

export type RecordPaymentInput = {
  invoice_id: string;
  amount: number;
  payment_date: string;
  note?: string | null;
};

export type CustomerInvoiceSummary = {
  totalInvoiced: number;
  outstandingBalance: number;
  overdueBalance: number;
  paidTotal: number;
  invoiceCount: number;
};

export type InvoiceMetrics = {
  draftCount: number;
  outstandingTotal: number;
  overdueTotal: number;
  paidThisMonth: number;
};

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

export const STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
  sent: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
  viewed: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  partially_paid: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  paid: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  overdue: "bg-rose-500/10 text-rose-300 border-rose-500/20",
  void: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

export const EDITABLE_STATUSES: InvoiceStatus[] = ["draft"];
export const NON_EDITABLE_STATUSES: InvoiceStatus[] = ["paid", "void"];

export function isInvoiceEditable(status: InvoiceStatus): boolean {
  return status === "draft";
}

export function requiresEditWarning(status: InvoiceStatus): boolean {
  return status === "paid" || status === "void";
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}
