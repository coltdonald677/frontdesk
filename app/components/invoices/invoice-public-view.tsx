import type { PublicInvoiceView } from "@/lib/invoices/delivery-types";
import { formatCurrency } from "@/lib/invoices/types";

type InvoicePublicViewProps = {
  invoice: PublicInvoiceView;
};

export function InvoicePublicView({ invoice }: InvoicePublicViewProps) {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <header className="flex items-start justify-between border-b border-zinc-200 pb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
              Invoice
            </p>
            <h1 className="mt-2 text-3xl font-bold">{invoice.invoice_number}</h1>
            <p className="mt-1 text-sm text-zinc-500">For {invoice.customer_name}</p>
          </div>
          <div className="text-right text-sm text-zinc-600">
            <p>Issue date: {invoice.issue_date}</p>
            {invoice.due_date && <p>Due date: {invoice.due_date}</p>}
          </div>
        </header>

        <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">From</p>
            <p className="mt-2 font-medium">{invoice.business_name}</p>
            {invoice.business_address && (
              <p className="text-sm text-zinc-600">{invoice.business_address}</p>
            )}
            {invoice.business_phone && (
              <p className="text-sm text-zinc-600">{invoice.business_phone}</p>
            )}
            {invoice.business_email && (
              <p className="text-sm text-zinc-600">{invoice.business_email}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Bill to</p>
            <p className="mt-2 font-medium">{invoice.customer_name}</p>
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
            {invoice.line_items.map((item, index) => (
              <tr key={`${item.description}-${index}`} className="border-b border-zinc-100">
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
          <div className="flex justify-between">
            <span className="text-zinc-500">Subtotal</span>
            <span>{formatCurrency(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Discount</span>
            <span>-{formatCurrency(invoice.discount_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Tax</span>
            <span>{formatCurrency(invoice.tax_amount)}</span>
          </div>
          <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{formatCurrency(invoice.total_amount)}</span>
          </div>
          <div className="flex justify-between text-zinc-600">
            <span>Paid</span>
            <span>{formatCurrency(invoice.amount_paid)}</span>
          </div>
          <div className="flex justify-between font-semibold text-zinc-900">
            <span>Balance due</span>
            <span>{formatCurrency(invoice.balance_due)}</span>
          </div>
        </div>

        <footer className="mt-12 border-t border-zinc-200 pt-6 text-xs text-zinc-500">
          Secure invoice link from {invoice.business_name}
        </footer>
      </div>
    </div>
  );
}
