"use client";

import Link from "next/link";
import type { BusinessProfile } from "@/lib/business-profile";
import type { InvoiceWithDetails } from "@/lib/invoices";
import { formatCurrency, STATUS_LABELS } from "@/lib/invoices/types";

type InvoicePrintLayoutProps = {
  invoice: InvoiceWithDetails;
  businessProfile: BusinessProfile;
};

export function InvoicePrintLayout({
  invoice,
  businessProfile,
}: InvoicePrintLayoutProps) {
  const customerName =
    invoice.customers?.company || invoice.customers?.name || "Customer";

  return (
    <div className="min-h-screen bg-white text-zinc-900 print:bg-white">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>

      <div className="no-print border-b border-zinc-200 bg-zinc-50 px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <p className="text-sm text-zinc-600">Print-friendly invoice preview</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
            >
              Print / Save PDF
            </button>
            <Link
              href={`/dashboard/invoices/${invoice.id}`}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700"
            >
              Back
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-10 print:px-0 print:py-0">
        <header className="flex items-start justify-between border-b border-zinc-200 pb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
              Pluto Invoice
            </p>
            <h1 className="mt-2 text-3xl font-bold">{invoice.invoice_number}</h1>
            <p className="mt-1 text-sm text-zinc-500">{STATUS_LABELS[invoice.status]}</p>
          </div>
          <div className="text-right text-sm text-zinc-600">
            <p>Issue date: {invoice.issue_date}</p>
            {invoice.due_date && <p>Due date: {invoice.due_date}</p>}
          </div>
        </header>

        <div className="mt-8 grid grid-cols-2 gap-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">From</p>
            <p className="mt-2 font-medium">{businessProfile.business_name}</p>
            <p className="text-sm text-zinc-600">{businessProfile.business_address}</p>
            <p className="text-sm text-zinc-600">{businessProfile.phone_number}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Bill to</p>
            <p className="mt-2 font-medium">{customerName}</p>
            {invoice.customers?.email && (
              <p className="text-sm text-zinc-600">{invoice.customers.email}</p>
            )}
            {invoice.customers?.phone && (
              <p className="text-sm text-zinc-600">{invoice.customers.phone}</p>
            )}
          </div>
        </div>

        {invoice.customer_message && (
          <p className="mt-8 rounded-lg bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
            {invoice.customer_message}
          </p>
        )}

        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500">
              <th className="py-3 pr-4 font-medium">Description</th>
              <th className="py-3 pr-4 font-medium">Qty</th>
              <th className="py-3 pr-4 font-medium">Rate</th>
              <th className="py-3 pr-4 font-medium">Tax</th>
              <th className="py-3 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.line_items.map((item) => (
              <tr key={item.id} className="border-b border-zinc-100">
                <td className="py-3 pr-4">{item.description}</td>
                <td className="py-3 pr-4">{item.quantity}</td>
                <td className="py-3 pr-4">{formatCurrency(item.unit_price)}</td>
                <td className="py-3 pr-4">{item.tax_rate}%</td>
                <td className="py-3 text-right">{formatCurrency(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-8 ml-auto w-full max-w-xs space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-zinc-500">Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Discount</span><span>-{formatCurrency(invoice.discount_amount)}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Tax</span><span>{formatCurrency(invoice.tax_amount)}</span></div>
          <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold">
            <span>Total</span><span>{formatCurrency(invoice.total_amount)}</span>
          </div>
          <div className="flex justify-between text-zinc-600">
            <span>Paid</span><span>{formatCurrency(invoice.amount_paid)}</span>
          </div>
          <div className="flex justify-between font-semibold text-zinc-900">
            <span>Balance due</span><span>{formatCurrency(invoice.balance_due)}</span>
          </div>
        </div>

        <footer className="mt-12 border-t border-zinc-200 pt-6 text-xs text-zinc-500">
          Generated by Pluto · {businessProfile.business_name}
        </footer>
      </div>
    </div>
  );
}
