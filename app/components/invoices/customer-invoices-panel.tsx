"use client";

import Link from "next/link";
import type { CustomerInvoiceSummary, InvoiceWithCustomer } from "@/lib/invoices";
import { STATUS_LABELS, STATUS_STYLES, formatCurrency } from "@/lib/invoices/types";
import { invoicesLink } from "@/lib/dashboard/links";

type CustomerInvoicesPanelProps = {
  customerId: string;
  invoices: InvoiceWithCustomer[];
  summary: CustomerInvoiceSummary;
};

export function CustomerInvoicesPanel({
  customerId,
  invoices,
  summary,
}: CustomerInvoicesPanelProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total invoiced", value: formatCurrency(summary.totalInvoiced) },
          { label: "Outstanding", value: formatCurrency(summary.outstandingBalance) },
          { label: "Overdue", value: formatCurrency(summary.overdueBalance) },
          { label: "Paid total", value: formatCurrency(summary.paidTotal) },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-white/[0.06] bg-zinc-900/40 px-4 py-3"
          >
            <p className="text-xs text-zinc-500">{stat.label}</p>
            <p className="mt-1 text-lg font-semibold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">
          Invoices ({summary.invoiceCount})
        </h3>
        <Link
          href={invoicesLink({ newInvoice: true, customerId })}
          className="text-xs font-medium text-indigo-300 hover:text-indigo-200"
        >
          Create invoice
        </Link>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 px-6 py-10 text-center">
          <p className="text-sm text-zinc-400">No invoices for this customer yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((invoice) => (
            <Link
              key={invoice.id}
              href={invoicesLink({ invoiceId: invoice.id })}
              className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-zinc-900/40 px-4 py-3 transition-colors hover:border-indigo-500/20"
            >
              <div>
                <p className="text-sm font-medium text-white">{invoice.invoice_number}</p>
                <p className="text-xs text-zinc-500">
                  {invoice.issue_date}
                  {invoice.due_date ? ` · Due ${invoice.due_date}` : ""}
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${STATUS_STYLES[invoice.status]}`}
                >
                  {STATUS_LABELS[invoice.status]}
                </span>
                <p className="mt-1 text-sm text-zinc-300">
                  {formatCurrency(invoice.total_amount)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
