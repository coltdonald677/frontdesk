import "server-only";

import { getTodayIsoDate, formatDisplayDate, formatTimeRange } from "@/lib/appointments/datetime";
import { createClient } from "@/lib/supabase/server";
import {
  calculateInvoiceTotals,
  calculateLineTotal,
  canMarkOverdue,
  deriveStatusAfterPayment,
  validateLineItems,
} from "./calculations";
import { allocateInvoiceNumber } from "./numbering";
import { verifyInvoiceForeignKeys, verifyAppointmentBelongsToBusiness } from "./ownership-security";
import {
  validatePaymentAgainstBalance,
  validatePaymentAmount,
} from "./payment-security";
import { canVoidInvoice } from "./void-security";
import type { InvoiceEditAuthorization } from "./edit-authorization";
import { authorizeInvoiceEdit } from "./edit-authorization";
import type {
  CreateInvoiceInput,
  CustomerInvoiceSummary,
  Invoice,
  InvoiceFilter,
  InvoiceLineItem,
  InvoiceLineItemInput,
  InvoiceMetrics,
  InvoicePayment,
  InvoiceStatus,
  InvoiceWithCustomer,
  InvoiceWithDetails,
  RecordPaymentInput,
  UpdateInvoiceInput,
  InvoiceDraftFromAppointment,
} from "./types";

const CUSTOMER_SELECT =
  "customers(id, name, company, email, phone)";

function mapInvoice(row: Record<string, unknown>): Invoice {
  return {
    ...(row as Invoice),
    subtotal: Number(row.subtotal),
    discount_amount: Number(row.discount_amount),
    tax_amount: Number(row.tax_amount),
    total_amount: Number(row.total_amount),
    amount_paid: Number(row.amount_paid),
    balance_due: Number(row.balance_due),
  };
}

function mapLineItem(row: Record<string, unknown>): InvoiceLineItem {
  return {
    ...(row as InvoiceLineItem),
    quantity: Number(row.quantity),
    unit_price: Number(row.unit_price),
    tax_rate: Number(row.tax_rate),
    line_total: Number(row.line_total),
  };
}

function mapPayment(row: Record<string, unknown>): InvoicePayment {
  return {
    ...(row as InvoicePayment),
    amount: Number(row.amount),
  };
}

function buildLineItemRows(
  invoiceId: string,
  lineItems: InvoiceLineItemInput[],
) {
  return lineItems.map((item, index) => ({
    invoice_id: invoiceId,
    description: item.description.trim(),
    quantity: item.quantity,
    unit_price: item.unit_price,
    tax_rate: item.tax_rate,
    line_total: calculateLineTotal(item.quantity, item.unit_price, item.tax_rate),
    sort_order: item.sort_order ?? index,
  }));
}

async function verifyCustomerOwnership(
  businessProfileId: string,
  customerId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const result = await verifyInvoiceForeignKeys(
    supabase,
    businessProfileId,
    customerId,
    null,
  );
  return result.ok;
}

async function verifyAppointmentOwnership(
  businessProfileId: string,
  appointmentId: string,
  customerId?: string,
): Promise<boolean> {
  const supabase = await createClient();
  const result = await verifyAppointmentBelongsToBusiness(
    supabase,
    businessProfileId,
    appointmentId,
    customerId,
  );
  return result.ok;
}

export async function getActiveInvoiceForAppointment(
  businessProfileId: string,
  appointmentId: string,
): Promise<Invoice | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("business_profile_id", businessProfileId)
    .eq("appointment_id", appointmentId)
    .not("status", "in", '("void","paid")')
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapInvoice(data) : null;
}

export async function getInvoices(
  businessProfileId: string,
  options?: {
    filter?: InvoiceFilter;
    search?: string;
    customerId?: string;
    limit?: number;
  },
): Promise<InvoiceWithCustomer[]> {
  const supabase = await createClient();
  const filter = options?.filter ?? "all";
  const limit = options?.limit ?? 100;

  let query = supabase
    .from("invoices")
    .select(`*, ${CUSTOMER_SELECT}`)
    .eq("business_profile_id", businessProfileId)
    .order("issue_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options?.customerId) {
    query = query.eq("customer_id", options.customerId);
  }

  switch (filter) {
    case "draft":
      query = query.eq("status", "draft");
      break;
    case "sent":
      query = query.in("status", ["sent", "viewed", "partially_paid"]);
      break;
    case "overdue":
      query = query.eq("status", "overdue");
      break;
    case "paid":
      query = query.eq("status", "paid");
      break;
    case "void":
      query = query.eq("status", "void");
      break;
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  let invoices = (data ?? []).map((row) => mapInvoice(row) as InvoiceWithCustomer);

  const search = options?.search?.trim().toLowerCase();
  if (search) {
    invoices = invoices.filter((invoice) => {
      const customerName =
        invoice.customers?.company ||
        invoice.customers?.name ||
        "";
      return (
        invoice.invoice_number.toLowerCase().includes(search) ||
        customerName.toLowerCase().includes(search) ||
        invoice.status.toLowerCase().includes(search)
      );
    });
  }

  return invoices;
}

export async function getInvoiceById(
  businessProfileId: string,
  invoiceId: string,
): Promise<InvoiceWithDetails | null> {
  const supabase = await createClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(`*, ${CUSTOMER_SELECT}, appointments(id, title, appointment_date, status)`)
    .eq("business_profile_id", businessProfileId)
    .eq("id", invoiceId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!invoice) {
    return null;
  }

  const [{ data: lineItems }, { data: payments }] = await Promise.all([
    supabase
      .from("invoice_line_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("invoice_payments")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("payment_date", { ascending: false }),
  ]);

  return {
    ...(mapInvoice(invoice) as InvoiceWithCustomer),
    line_items: (lineItems ?? []).map(mapLineItem),
    payments: (payments ?? []).map(mapPayment),
    appointments: invoice.appointments as InvoiceWithDetails["appointments"],
  };
}

export async function getCustomerInvoiceSummary(
  businessProfileId: string,
  customerId: string,
): Promise<CustomerInvoiceSummary> {
  const invoices = await getInvoices(businessProfileId, { customerId, limit: 500 });

  let totalInvoiced = 0;
  let outstandingBalance = 0;
  let overdueBalance = 0;
  let paidTotal = 0;

  for (const invoice of invoices) {
    if (invoice.status === "void") continue;
    totalInvoiced += invoice.total_amount;
    paidTotal += invoice.amount_paid;
    if (invoice.balance_due > 0 && invoice.status !== "paid") {
      outstandingBalance += invoice.balance_due;
    }
    if (invoice.status === "overdue") {
      overdueBalance += invoice.balance_due;
    }
  }

  return {
    totalInvoiced,
    outstandingBalance,
    overdueBalance,
    paidTotal,
    invoiceCount: invoices.filter((i) => i.status !== "void").length,
  };
}

export async function getInvoiceMetrics(
  businessProfileId: string,
): Promise<InvoiceMetrics> {
  const supabase = await createClient();
  const today = getTodayIsoDate();
  const monthStart = `${today.slice(0, 7)}-01`;

  const { data, error } = await supabase
    .from("invoices")
    .select("status, balance_due, amount_paid, updated_at")
    .eq("business_profile_id", businessProfileId)
    .neq("status", "void");

  if (error) {
    throw new Error(error.message);
  }

  let draftCount = 0;
  let outstandingTotal = 0;
  let overdueTotal = 0;
  let paidThisMonth = 0;

  for (const row of data ?? []) {
    const balanceDue = Number(row.balance_due);
    const amountPaid = Number(row.amount_paid);

    if (row.status === "draft") {
      draftCount += 1;
    }

    if (["sent", "viewed", "partially_paid", "overdue"].includes(row.status)) {
      outstandingTotal += balanceDue;
    }

    if (row.status === "overdue") {
      overdueTotal += balanceDue;
    }

    if (
      row.status === "paid" &&
      row.updated_at >= `${monthStart}T00:00:00`
    ) {
      paidThisMonth += amountPaid;
    }
  }

  return {
    draftCount,
    outstandingTotal,
    overdueTotal,
    paidThisMonth,
  };
}

export async function syncOverdueInvoices(
  businessProfileId: string,
): Promise<number> {
  const supabase = await createClient();
  const today = getTodayIsoDate();

  const { data, error } = await supabase
    .from("invoices")
    .select("id, status, due_date, balance_due")
    .eq("business_profile_id", businessProfileId)
    .in("status", ["sent", "viewed", "partially_paid", "overdue"]);

  if (error) {
    throw new Error(error.message);
  }

  const toMark = (data ?? []).filter((row) =>
    canMarkOverdue(row.status, row.due_date, Number(row.balance_due), today),
  );

  if (toMark.length === 0) {
    return 0;
  }

  const { error: updateError } = await supabase
    .from("invoices")
    .update({ status: "overdue" })
    .in(
      "id",
      toMark.map((row) => row.id),
    )
    .eq("business_profile_id", businessProfileId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return toMark.length;
}

export async function createInvoice(
  businessProfileId: string,
  input: CreateInvoiceInput,
): Promise<InvoiceWithDetails> {
  const validationError = validateLineItems(input.line_items);
  if (validationError) {
    throw new Error(validationError);
  }

  if (!(await verifyCustomerOwnership(businessProfileId, input.customer_id))) {
    throw new Error("Customer not found.");
  }

  if (input.appointment_id) {
    if (
      !(await verifyAppointmentOwnership(
        businessProfileId,
        input.appointment_id,
        input.customer_id,
      ))
    ) {
      throw new Error("Appointment not found.");
    }
  }

  const totals = calculateInvoiceTotals(
    input.line_items,
    input.discount_amount ?? 0,
  );

  const supabase = await createClient();
  const invoiceNumber = await allocateInvoiceNumber(businessProfileId);
  const status = input.status ?? "draft";

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      business_profile_id: businessProfileId,
      customer_id: input.customer_id,
      appointment_id: input.appointment_id ?? null,
      invoice_number: invoiceNumber,
      status,
      issue_date: input.issue_date,
      due_date: input.due_date ?? null,
      subtotal: totals.subtotal,
      discount_amount: totals.discountAmount,
      tax_amount: totals.taxAmount,
      total_amount: totals.totalAmount,
      amount_paid: 0,
      balance_due: totals.totalAmount,
      notes: input.notes?.trim() || null,
      customer_message: input.customer_message?.trim() || null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const lineItemRows = buildLineItemRows(invoice.id, input.line_items);
  const { error: lineError } = await supabase
    .from("invoice_line_items")
    .insert(lineItemRows);

  if (lineError) {
    throw new Error(lineError.message);
  }

  const result = await getInvoiceById(businessProfileId, invoice.id);
  if (!result) {
    throw new Error("Invoice could not be loaded after creation.");
  }

  return result;
}

export async function updateInvoice(
  businessProfileId: string,
  input: UpdateInvoiceInput,
  options: {
    authorization: InvoiceEditAuthorization & { allowed: true };
    acknowledgedClosedEdit?: boolean;
  },
): Promise<InvoiceWithDetails> {
  const existing = await getInvoiceById(businessProfileId, input.id);
  if (!existing) {
    throw new Error("Invoice not found.");
  }

  const authorization = authorizeInvoiceEdit(existing.status);
  if (!authorization.allowed) {
    throw new Error(authorization.error);
  }

  if (authorization.mode !== options.authorization.mode) {
    throw new Error("This invoice cannot be edited in its current state.");
  }

  if (
    authorization.mode === "closed_override" &&
    !options.acknowledgedClosedEdit
  ) {
    throw new Error(
      "Confirmation required to edit a paid or void invoice.",
    );
  }

  const validationError = validateLineItems(input.line_items);
  if (validationError) {
    throw new Error(validationError);
  }

  if (!(await verifyCustomerOwnership(businessProfileId, input.customer_id))) {
    throw new Error("Customer not found.");
  }

  if (input.appointment_id) {
    if (
      !(await verifyAppointmentOwnership(
        businessProfileId,
        input.appointment_id,
        input.customer_id,
      ))
    ) {
      throw new Error("Appointment not found.");
    }
  }

  const totals = calculateInvoiceTotals(
    input.line_items,
    input.discount_amount ?? 0,
  );
  const balanceDue = Math.max(0, totals.totalAmount - existing.amount_paid);

  const supabase = await createClient();

  const { error } = await supabase
    .from("invoices")
    .update({
      customer_id: input.customer_id,
      appointment_id: input.appointment_id ?? null,
      issue_date: input.issue_date,
      due_date: input.due_date ?? null,
      subtotal: totals.subtotal,
      discount_amount: totals.discountAmount,
      tax_amount: totals.taxAmount,
      total_amount: totals.totalAmount,
      balance_due: balanceDue,
      notes: input.notes?.trim() || null,
      customer_message: input.customer_message?.trim() || null,
      status:
        existing.status === "paid" || existing.status === "void"
          ? existing.status
          : deriveStatusAfterPayment(
              totals.totalAmount,
              existing.amount_paid,
              existing.status,
            ) === "paid"
            ? "paid"
            : existing.status === "draft"
              ? "draft"
              : balanceDue <= 0
                ? "paid"
                : existing.status,
    })
    .eq("id", input.id)
    .eq("business_profile_id", businessProfileId);

  if (error) {
    throw new Error(error.message);
  }

  await supabase.from("invoice_line_items").delete().eq("invoice_id", input.id);

  const lineItemRows = buildLineItemRows(input.id, input.line_items);
  const { error: lineError } = await supabase
    .from("invoice_line_items")
    .insert(lineItemRows);

  if (lineError) {
    throw new Error(lineError.message);
  }

  const result = await getInvoiceById(businessProfileId, input.id);
  if (!result) {
    throw new Error("Invoice could not be loaded after update.");
  }

  return result;
}

export async function updateInvoiceStatus(
  businessProfileId: string,
  invoiceId: string,
  status: InvoiceStatus,
): Promise<InvoiceWithDetails> {
  const existing = await getInvoiceById(businessProfileId, invoiceId);
  if (!existing) {
    throw new Error("Invoice not found.");
  }

  if (existing.status === "void" && status !== "void") {
    throw new Error("Void invoices cannot be changed.");
  }

  if (status === "void") {
    const voidCheck = canVoidInvoice({
      status: existing.status,
      amount_paid: existing.amount_paid,
      payment_count: existing.payments.length,
    });
    if (!voidCheck.ok) {
      throw new Error(voidCheck.error);
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .update({ status })
    .eq("id", invoiceId)
    .eq("business_profile_id", businessProfileId);

  if (error) {
    throw new Error(error.message);
  }

  const result = await getInvoiceById(businessProfileId, invoiceId);
  if (!result) {
    throw new Error("Invoice not found.");
  }

  return result;
}

export async function recordInvoicePayment(
  businessProfileId: string,
  input: RecordPaymentInput,
): Promise<InvoiceWithDetails> {
  const existing = await getInvoiceById(businessProfileId, input.invoice_id);
  if (!existing) {
    throw new Error("Invoice not found.");
  }

  if (existing.status === "void") {
    throw new Error("Cannot record payment on a void invoice.");
  }

  const amountCheck = validatePaymentAmount(input.amount);
  if (!amountCheck.ok) {
    throw new Error(amountCheck.error);
  }

  const balanceCheck = validatePaymentAgainstBalance(
    amountCheck.amount,
    existing.total_amount,
    existing.amount_paid,
  );
  if (!balanceCheck.ok) {
    throw new Error(balanceCheck.error);
  }

  const supabase = await createClient();

  const { data: paymentId, error: rpcError } = await supabase.rpc(
    "record_invoice_payment_secure",
    {
      p_invoice_id: input.invoice_id,
      p_business_profile_id: businessProfileId,
      p_amount: amountCheck.amount,
      p_payment_date: input.payment_date,
      p_note: input.note?.trim() || null,
    },
  );

  if (rpcError) {
    if (rpcError.message.includes("Payment exceeds remaining balance")) {
      throw new Error("Payment exceeds the remaining balance.");
    }
    if (rpcError.message.includes("Payment amount must be greater than zero")) {
      throw new Error("Payment amount must be greater than zero.");
    }
    if (rpcError.message.includes("void invoice")) {
      throw new Error("Cannot record payment on a void invoice.");
    }
    if (rpcError.message.includes("Invoice not found")) {
      throw new Error("Invoice not found.");
    }
    throw new Error("Could not record payment. Please try again.");
  }

  if (!paymentId) {
    throw new Error("Could not record payment. Please try again.");
  }

  const result = await getInvoiceById(businessProfileId, input.invoice_id);
  if (!result) {
    throw new Error("Invoice not found.");
  }

  return result;
}

export async function duplicateInvoice(
  businessProfileId: string,
  invoiceId: string,
): Promise<InvoiceWithDetails> {
  const existing = await getInvoiceById(businessProfileId, invoiceId);
  if (!existing) {
    throw new Error("Invoice not found.");
  }

  return createInvoice(businessProfileId, {
    customer_id: existing.customer_id,
    appointment_id: null,
    issue_date: getTodayIsoDate(),
    due_date: existing.due_date,
    discount_amount: existing.discount_amount,
    notes: existing.notes,
    customer_message: existing.customer_message,
    line_items: existing.line_items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      tax_rate: item.tax_rate,
      sort_order: item.sort_order,
    })),
    status: "draft",
  });
}

export async function getCompletedAppointmentsWithoutInvoice(
  businessProfileId: string,
  limit = 5,
): Promise<
  Array<{
    id: string;
    title: string;
    customer_id: string;
    appointment_date: string;
    customer_name: string;
  }>
> {
  const supabase = await createClient();
  const today = getTodayIsoDate();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString().slice(0, 10);

  const [{ data: appointments }, { data: invoiced }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, title, customer_id, appointment_date, customers(name, company)")
      .eq("business_profile_id", businessProfileId)
      .eq("status", "completed")
      .gte("appointment_date", since)
      .lte("appointment_date", today)
      .order("appointment_date", { ascending: false })
      .limit(50),
    supabase
      .from("invoices")
      .select("appointment_id")
      .eq("business_profile_id", businessProfileId)
      .not("appointment_id", "is", null)
      .not("status", "eq", "void"),
  ]);

  const invoicedIds = new Set(
    (invoiced ?? []).map((row) => row.appointment_id).filter(Boolean),
  );

  return (appointments ?? [])
    .filter((row) => !invoicedIds.has(row.id))
    .slice(0, limit)
    .map((row) => {
      const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
      return {
        id: row.id,
        title: row.title,
        customer_id: row.customer_id,
        appointment_date: row.appointment_date,
        customer_name: customer?.company || customer?.name || "Customer",
      };
    });
}

export async function buildInvoiceDraftFromAppointment(
  businessProfileId: string,
  appointmentId: string,
): Promise<InvoiceDraftFromAppointment | null> {
  const supabase = await createClient();

  const { data: appointment, error } = await supabase
    .from("appointments")
    .select(
      "id, customer_id, title, appointment_date, start_time, end_time, notes, status, customers(name, company), employees(full_name)",
    )
    .eq("business_profile_id", businessProfileId)
    .eq("id", appointmentId)
    .maybeSingle();

  if (error || !appointment || appointment.status !== "completed") {
    return null;
  }

  const customer = Array.isArray(appointment.customers)
    ? appointment.customers[0]
    : appointment.customers;
  const employee = Array.isArray(appointment.employees)
    ? appointment.employees[0]
    : appointment.employees;

  const customerName = customer?.company || customer?.name || "Customer";
  const dateLabel = formatDisplayDate(appointment.appointment_date);
  const timeLabel = formatTimeRange(
    appointment.start_time.slice(0, 5),
    appointment.end_time.slice(0, 5),
  );

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);

  const serviceDescription = [
    appointment.title,
    dateLabel,
    timeLabel,
  ].join(" · ");

  return {
    appointment: {
      id: appointment.id,
      title: appointment.title,
      appointmentDate: appointment.appointment_date,
      dateLabel,
      timeLabel,
      customerName,
      employeeName: employee?.full_name ?? null,
    },
    input: {
      customer_id: appointment.customer_id,
      appointment_id: appointment.id,
      issue_date: getTodayIsoDate(),
      due_date: dueDate.toISOString().slice(0, 10),
      discount_amount: 0,
      notes: appointment.notes,
      customer_message: `Thank you for your business, ${customer?.name?.split(" ")[0] ?? "there"}.`,
      line_items: [
        {
          description: serviceDescription,
          quantity: 1,
          unit_price: 0,
          tax_rate: 0,
        },
      ],
      status: "draft",
    },
  };
}
