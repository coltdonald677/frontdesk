"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RecordPaymentModal } from "@/app/components/invoices/record-payment-modal";
import {
  duplicateInvoiceAction,
  markInvoicePaidAction,
  markInvoiceSentAction,
  markInvoiceViewedAction,
  voidInvoiceAction,
} from "@/app/dashboard/invoices/actions";
import type { BusinessProfile } from "@/lib/business-profile";
import type { InvoiceWithDetails } from "@/lib/invoices";
import {
  STATUS_LABELS,
  STATUS_STYLES,
  formatCurrency,
  isInvoiceEditable,
} from "@/lib/invoices/types";
import type { InvoiceDeliverySummary } from "@/lib/invoices/delivery-types";
import {
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_STYLES,
} from "@/lib/invoices/delivery-types";
import { SendInvoiceModal } from "@/app/components/invoices/send-invoice-modal";
import { canVoidInvoice } from "@/lib/invoices/void-security";
import { customerProfileLink } from "@/lib/dashboard/links";

type InvoiceDetailClientProps = {
  invoice: InvoiceWithDetails;
  businessProfile: BusinessProfile;
  delivery: InvoiceDeliverySummary;
};

export function InvoiceDetailClient({
  invoice,
  businessProfile,
  delivery,
}: InvoiceDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);

  const customerName =
    invoice.customers?.company || invoice.customers?.name || "Customer";

  const voidAllowed = canVoidInvoice({
    status: invoice.status,
    amount_paid: invoice.amount_paid,
    payment_count: invoice.payments.length,
  }).ok;

  function runAction(action: () => Promise<{ error?: string; success?: boolean; invoiceId?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.invoiceId) {
        router.push(`/dashboard/invoices/${result.invoiceId}`);
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-white">{invoice.invoice_number}</h1>
            <span
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase ${STATUS_STYLES[invoice.status]}`}
            >
              {STATUS_LABELS[invoice.status]}
            </span>
            <span
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase ${DELIVERY_STATUS_STYLES[delivery.status]}`}
            >
              {DELIVERY_STATUS_LABELS[delivery.status]}
            </span>
          </div>
          <p className="mt-2 text-zinc-400">
            {customerName} · Issued {invoice.issue_date}
            {invoice.due_date ? ` · Due ${invoice.due_date}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isInvoiceEditable(invoice.status) && (
            <Link
              href={`/dashboard/invoices/${invoice.id}?edit=1`}
              className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/5"
            >
              Edit draft
            </Link>
          )}
          {invoice.status !== "void" && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => setSendOpen(true)}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-zinc-950"
            >
              Send invoice
            </button>
          )}
          {invoice.status === "draft" && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => runAction(() => markInvoiceSentAction(invoice.id))}
              className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-zinc-300"
            >
              Mark sent
            </button>
          )}
          {["sent", "partially_paid", "overdue"].includes(invoice.status) && (
            <>
              <button
                type="button"
                disabled={isPending}
                onClick={() => runAction(() => markInvoiceViewedAction(invoice.id))}
                className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-zinc-300"
              >
                Mark viewed
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setPaymentOpen(true)}
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200"
              >
                Record payment
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => runAction(() => markInvoicePaidAction(invoice.id))}
                className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-zinc-300"
              >
                Mark paid
              </button>
            </>
          )}
          {voidAllowed && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => runAction(() => voidInvoiceAction(invoice.id))}
              className="rounded-lg border border-rose-500/20 px-3 py-1.5 text-xs font-medium text-rose-300"
            >
              Void
            </button>
          )}
          <button
            type="button"
            disabled={isPending}
            onClick={() => runAction(() => duplicateInvoiceAction(invoice.id))}
            className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-zinc-300"
          >
            Duplicate
          </button>
          <Link
            href={`/dashboard/invoices/${invoice.id}/print`}
            target="_blank"
            className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-200"
          >
            Print / PDF
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-5">
          <h2 className="text-sm font-semibold text-white">From</h2>
          <p className="mt-2 text-sm text-zinc-300">{businessProfile.business_name}</p>
          <p className="text-sm text-zinc-400">{businessProfile.business_address}</p>
          <p className="text-sm text-zinc-400">{businessProfile.phone_number}</p>
        </section>
        <section className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-5">
          <h2 className="text-sm font-semibold text-white">Bill to</h2>
          <p className="mt-2 text-sm text-zinc-300">{customerName}</p>
          {invoice.customers?.email && (
            <p className="text-sm text-zinc-400">{invoice.customers.email}</p>
          )}
          {invoice.customers?.phone && (
            <p className="text-sm text-zinc-400">{invoice.customers.phone}</p>
          )}
          <Link
            href={customerProfileLink(invoice.customer_id, "invoices")}
            className="mt-2 inline-block text-xs text-indigo-300 hover:text-indigo-200"
          >
            View customer workspace
          </Link>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-white/[0.06]">
        <table className="min-w-full divide-y divide-white/[0.06]">
          <thead className="bg-zinc-900/80">
            <tr>
              {["Description", "Qty", "Rate", "Tax", "Total"].map((heading) => (
                <th key={heading} className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {invoice.line_items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 text-sm text-zinc-200">{item.description}</td>
                <td className="px-4 py-3 text-sm text-zinc-400">{item.quantity}</td>
                <td className="px-4 py-3 text-sm text-zinc-400">{formatCurrency(item.unit_price)}</td>
                <td className="px-4 py-3 text-sm text-zinc-400">{item.tax_rate}%</td>
                <td className="px-4 py-3 text-sm text-zinc-200">{formatCurrency(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-5">
          {invoice.customer_message && (
            <>
              <h2 className="text-sm font-semibold text-white">Message</h2>
              <p className="mt-2 text-sm text-zinc-400">{invoice.customer_message}</p>
            </>
          )}
          {invoice.notes && (
            <div className="mt-4">
              <h2 className="text-sm font-semibold text-white">Internal notes</h2>
              <p className="mt-2 text-sm text-zinc-500">{invoice.notes}</p>
            </div>
          )}
        </section>
        <section className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-5 text-sm">
          <div className="flex justify-between text-zinc-400"><span>Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span></div>
          <div className="mt-1 flex justify-between text-zinc-400"><span>Discount</span><span>-{formatCurrency(invoice.discount_amount)}</span></div>
          <div className="mt-1 flex justify-between text-zinc-400"><span>Tax</span><span>{formatCurrency(invoice.tax_amount)}</span></div>
          <div className="mt-2 flex justify-between font-semibold text-white"><span>Total</span><span>{formatCurrency(invoice.total_amount)}</span></div>
          <div className="mt-2 flex justify-between text-emerald-300"><span>Paid</span><span>{formatCurrency(invoice.amount_paid)}</span></div>
          <div className="mt-1 flex justify-between font-semibold text-amber-200"><span>Balance due</span><span>{formatCurrency(invoice.balance_due)}</span></div>
        </section>
      </div>

      {invoice.payments.length > 0 && (
        <section className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-5">
          <h2 className="text-sm font-semibold text-white">Payment history</h2>
          <div className="mt-3 space-y-2">
            {invoice.payments.map((payment) => (
              <div key={payment.id} className="flex justify-between text-sm text-zinc-400">
                <span>
                  {payment.payment_date}
                  {payment.note ? ` · ${payment.note}` : ""}
                </span>
                <span className="text-emerald-300">{formatCurrency(payment.amount)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {delivery.recipient_email && (
        <section className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-5 text-sm text-zinc-400">
          <h2 className="text-sm font-semibold text-white">Delivery</h2>
          <p className="mt-2">
            Last sent to {delivery.recipient_email}
            {delivery.sent_at ? ` on ${new Date(delivery.sent_at).toLocaleString()}` : ""}
          </p>
          {delivery.opened_at && (
            <p className="mt-1">Opened {new Date(delivery.opened_at).toLocaleString()}</p>
          )}
          {delivery.last_error && (
            <p className="mt-1 text-rose-300">{delivery.last_error}</p>
          )}
        </section>
      )}

      <RecordPaymentModal
        open={paymentOpen}
        invoiceId={invoice.id}
        balanceDue={invoice.balance_due}
        onClose={() => setPaymentOpen(false)}
      />
      <SendInvoiceModal
        open={sendOpen}
        invoiceId={invoice.id}
        onClose={() => setSendOpen(false)}
        onSent={() => router.refresh()}
      />
    </div>
  );
}
