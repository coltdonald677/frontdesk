"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import {
  createInvoiceAction,
  updateInvoiceAction,
  type InvoiceActionState,
} from "@/app/dashboard/invoices/actions";
import { CurrencyInput } from "@/app/components/invoices/currency-input";
import { InvoiceDateFields } from "@/app/components/invoices/invoice-date-fields";
import {
  InvoiceLineItemsEditor,
  createEmptyLineItem,
  type EditableLineItem,
} from "@/app/components/invoices/invoice-line-items-editor";
import type { Customer } from "@/lib/customers/types";
import type {
  CreateInvoiceInput,
  InvoiceAppointmentContext,
  InvoiceWithDetails,
} from "@/lib/invoices";
import {
  calculateInvoiceTotals,
  validateLineItems,
} from "@/lib/invoices/calculations";
import {
  computeDueDateForTerm,
  defaultInvoiceDueDate,
  inferPaymentTerm,
  validateInvoiceDates,
  type PaymentTerm,
} from "@/lib/invoices/invoice-dates";
import { formatCurrency } from "@/lib/invoices/types";
import { getTodayIsoDate } from "@/lib/appointments/datetime";

type InvoiceFormDefaults = {
  defaultPaymentTerm: PaymentTerm;
  defaultTaxRate: number;
  defaultCustomerMessage: string;
  defaultInternalNotes: string;
};

type InvoiceFormProps = {
  customers: Customer[];
  invoice?: InvoiceWithDetails;
  initialDraft?: CreateInvoiceInput;
  appointmentContext?: InvoiceAppointmentContext;
  duplicateWarning?: string;
  invoiceDefaults?: InvoiceFormDefaults;
};

const fieldClassName =
  "w-full rounded-lg border border-white/[0.06] bg-zinc-950/50 px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500/40 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 disabled:opacity-50";

const labelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500";

function initLineItems(
  invoice?: InvoiceWithDetails,
  initialDraft?: CreateInvoiceInput,
): EditableLineItem[] {
  if (invoice?.line_items.length) {
    return invoice.line_items.map((item) => ({
      key: item.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      tax_rate: item.tax_rate,
      sort_order: item.sort_order,
    }));
  }
  if (initialDraft?.line_items.length) {
    return initialDraft.line_items.map((item) => ({
      ...item,
      key: crypto.randomUUID(),
    }));
  }
  return [createEmptyLineItem()];
}

function initIssueDate(
  invoice?: InvoiceWithDetails,
  initialDraft?: CreateInvoiceInput,
): string {
  return invoice?.issue_date ?? initialDraft?.issue_date ?? getTodayIsoDate();
}

function initDueDate(
  issueDate: string,
  invoice?: InvoiceWithDetails,
  initialDraft?: CreateInvoiceInput,
  defaults?: InvoiceFormDefaults,
): string {
  if (invoice?.due_date ?? initialDraft?.due_date) {
    return invoice?.due_date ?? initialDraft?.due_date ?? defaultInvoiceDueDate(issueDate);
  }
  if (defaults?.defaultPaymentTerm && defaults.defaultPaymentTerm !== "custom") {
    return computeDueDateForTerm(issueDate, defaults.defaultPaymentTerm);
  }
  return defaultInvoiceDueDate(issueDate);
}

export function InvoiceForm({
  customers,
  invoice,
  initialDraft,
  appointmentContext,
  duplicateWarning,
  invoiceDefaults,
}: InvoiceFormProps) {
  const router = useRouter();
  const isEditing = Boolean(invoice);
  const action = isEditing ? updateInvoiceAction : createInvoiceAction;
  const [state, formAction] = useActionState<InvoiceActionState, FormData>(action, {});

  const initialIssue = initIssueDate(invoice, initialDraft);
  const initialDue = initDueDate(initialIssue, invoice, initialDraft, invoiceDefaults);

  const [customerId, setCustomerId] = useState(
    invoice?.customer_id ?? initialDraft?.customer_id ?? "",
  );
  const [appointmentId] = useState(
    invoice?.appointment_id ?? initialDraft?.appointment_id ?? "",
  );
  const [issueDate, setIssueDate] = useState(initialIssue);
  const [dueDate, setDueDate] = useState(initialDue);
  const [paymentTerm, setPaymentTerm] = useState<PaymentTerm>(() =>
    inferPaymentTerm(initialIssue, initialDue),
  );
  const [discountAmount, setDiscountAmount] = useState(
    invoice?.discount_amount ?? initialDraft?.discount_amount ?? 0,
  );
  const [notes, setNotes] = useState(
    invoice?.notes ?? initialDraft?.notes ?? invoiceDefaults?.defaultInternalNotes ?? "",
  );
  const [customerMessage, setCustomerMessage] = useState(
    invoice?.customer_message ??
      initialDraft?.customer_message ??
      invoiceDefaults?.defaultCustomerMessage ??
      "",
  );
  const [forceDuplicate, setForceDuplicate] = useState(false);
  const [closedOverrideAcknowledged, setClosedOverrideAcknowledged] = useState(false);
  const [closedOverrideConfirmed, setClosedOverrideConfirmed] = useState(false);
  const [lineItems, setLineItems] = useState<EditableLineItem[]>(() =>
    initLineItems(invoice, initialDraft),
  );

  const selectedCustomer = customers.find((c) => c.id === customerId);

  const totals = useMemo(
    () => calculateInvoiceTotals(lineItems, discountAmount),
    [discountAmount, lineItems],
  );

  const dateError = useMemo(
    () => validateInvoiceDates(issueDate, dueDate),
    [dueDate, issueDate],
  );

  const validationError = useMemo(() => {
    if (!customerId) return "Select a customer.";
    if (dateError) return dateError;
    return validateLineItems(lineItems);
  }, [customerId, dateError, lineItems]);

  function handleIssueDateChange(nextIssueDate: string) {
    setIssueDate(nextIssueDate);
    if (paymentTerm !== "custom") {
      setDueDate(computeDueDateForTerm(nextIssueDate, paymentTerm));
    } else if (dueDate < nextIssueDate) {
      setDueDate(nextIssueDate);
    }
  }

  function handlePaymentTermChange(term: PaymentTerm) {
    setPaymentTerm(term);
    if (term === "custom") {
      if (!dueDate || dueDate < issueDate) {
        setDueDate(computeDueDateForTerm(issueDate, "7"));
      }
      return;
    }
    setDueDate(computeDueDateForTerm(issueDate, term));
  }

  function handleDueDateChange(nextDueDate: string) {
    setPaymentTerm("custom");
    setDueDate(nextDueDate);
  }

  useEffect(() => {
    if (state.success && state.invoiceId) {
      router.push(`/dashboard/invoices/${state.invoiceId}`);
      router.refresh();
    }
  }, [router, state.invoiceId, state.success]);

  const isClosedOverrideEligible =
    isEditing &&
    invoice &&
    (invoice.status === "paid" || invoice.status === "void");

  const readOnly =
    isEditing &&
    invoice &&
    invoice.status !== "draft" &&
    !(
      isClosedOverrideEligible &&
      closedOverrideAcknowledged &&
      closedOverrideConfirmed
    );

  return (
    <form action={formAction} className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">
            {isEditing ? "Edit invoice" : "New invoice"}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            {isEditing
              ? "Update line items and details before sending."
              : "Build a draft invoice with live totals."}
          </p>
        </div>
        {!readOnly && (
          <p className="text-right text-2xl font-bold tabular-nums text-white">
            {formatCurrency(totals.totalAmount)}
          </p>
        )}
      </div>

      {invoice && <input type="hidden" name="invoice_id" value={invoice.id} />}
      {appointmentId && (
        <input type="hidden" name="appointment_id" value={appointmentId} />
      )}
      <input type="hidden" name="force_duplicate" value={String(forceDuplicate)} />
      {closedOverrideConfirmed && (
        <input type="hidden" name="closed_override_ack" value="CONFIRMED" />
      )}
      <input type="hidden" name="issue_date" value={issueDate} />
      <input type="hidden" name="due_date" value={dueDate} />
      <input
        type="hidden"
        name="discount_amount"
        value={String(discountAmount)}
      />
      <input
        type="hidden"
        name="line_items"
        value={JSON.stringify(
          lineItems.map(({ key: _key, ...item }, index) => ({
            ...item,
            sort_order: index,
          })),
        )}
      />

      {(duplicateWarning || state.error) && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
          {state.error ?? duplicateWarning}
          {duplicateWarning && !forceDuplicate && (
            <label className="mt-2 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={forceDuplicate}
                onChange={(event) => setForceDuplicate(event.target.checked)}
              />
              Create another invoice for this appointment anyway
            </label>
          )}
        </div>
      )}

      {appointmentContext && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-500/25 bg-indigo-500/10 text-indigo-300">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">
                From completed appointment
              </p>
              <p className="mt-1 text-sm font-medium text-white">
                {appointmentContext.title}
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                {appointmentContext.customerName} · {appointmentContext.dateLabel} · {appointmentContext.timeLabel}
              </p>
              {appointmentContext.employeeName && (
                <p className="mt-1 text-xs text-zinc-500">
                  Assigned to {appointmentContext.employeeName}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {isClosedOverrideEligible && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-200">
          This invoice is {invoice.status}. Editing may affect financial records.
          {!closedOverrideAcknowledged && (
            <button
              type="button"
              onClick={() => setClosedOverrideAcknowledged(true)}
              className="ml-2 underline"
            >
              Edit anyway
            </button>
          )}
          {closedOverrideAcknowledged && !closedOverrideConfirmed && (
            <label className="mt-2 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={closedOverrideConfirmed}
                onChange={(event) => setClosedOverrideConfirmed(event.target.checked)}
              />
              I understand this may affect financial records
            </label>
          )}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-4 sm:p-5">
            <h3 className="mb-4 text-sm font-semibold text-white">Bill to</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="invoice_customer" className={labelClassName}>
                  Customer
                </label>
                <select
                  id="invoice_customer"
                  name="customer_id"
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                  disabled={readOnly || Boolean(appointmentContext)}
                  required
                  className={fieldClassName}
                >
                  <option value="">Select customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.company || customer.name}
                    </option>
                  ))}
                </select>
                {selectedCustomer && (
                  <p className="mt-2 text-xs text-zinc-500">
                    {[selectedCustomer.email, selectedCustomer.phone]
                      .filter(Boolean)
                      .join(" · ") || "No contact details on file"}
                  </p>
                )}
              </div>
            </div>
          </section>

          <InvoiceLineItemsEditor
            lineItems={lineItems}
            readOnly={readOnly}
            onChange={setLineItems}
          />

          <section className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="invoice_notes" className={labelClassName}>
                Internal notes
              </label>
              <textarea
                id="invoice_notes"
                name="notes"
                value={notes ?? ""}
                onChange={(event) => setNotes(event.target.value)}
                disabled={readOnly}
                rows={4}
                placeholder="Not shown on the customer invoice"
                className={`${fieldClassName} resize-none`}
              />
            </div>
            <div>
              <label htmlFor="invoice_customer_message" className={labelClassName}>
                Customer message
              </label>
              <textarea
                id="invoice_customer_message"
                name="customer_message"
                value={customerMessage ?? ""}
                onChange={(event) => setCustomerMessage(event.target.value)}
                disabled={readOnly}
                rows={4}
                placeholder="Shown on the invoice PDF"
                className={`${fieldClassName} resize-none`}
              />
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-4 sm:p-5">
            <h3 className="mb-4 text-sm font-semibold text-white">Invoice details</h3>
            <InvoiceDateFields
              issueDate={issueDate}
              dueDate={dueDate}
              paymentTerm={paymentTerm}
              onIssueDateChange={handleIssueDateChange}
              onDueDateChange={handleDueDateChange}
              onPaymentTermChange={handlePaymentTermChange}
              dateError={dateError}
              disabled={readOnly}
            />
          </section>

          <section className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-4 sm:p-5">
            <h3 className="mb-4 text-sm font-semibold text-white">Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between text-zinc-400">
                <span>Subtotal</span>
                <span className="tabular-nums text-zinc-200">
                  {formatCurrency(totals.subtotal)}
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span>Tax</span>
                <span className="tabular-nums text-zinc-200">
                  {formatCurrency(totals.taxAmount)}
                </span>
              </div>
              <div>
                <label htmlFor="invoice_discount" className={labelClassName}>
                  Discount
                </label>
                <CurrencyInput
                  id="invoice_discount"
                  value={discountAmount}
                  onChange={setDiscountAmount}
                  disabled={readOnly}
                />
              </div>
              <div className="border-t border-white/[0.06] pt-3">
                <div className="flex items-center justify-between text-base font-semibold text-white">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCurrency(totals.totalAmount)}</span>
                </div>
              </div>
            </div>
          </section>

          {!readOnly && (
            <button
              type="submit"
              disabled={
                Boolean(validationError) ||
                Boolean(duplicateWarning && !forceDuplicate)
              }
              className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isEditing ? "Save invoice" : "Create draft invoice"}
            </button>
          )}

          {validationError && (
            <p className="text-center text-sm text-rose-400">{validationError}</p>
          )}
        </aside>
      </div>
    </form>
  );
}
