"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState } from "@/app/components/ui/empty-state";
import type { InvoiceFilter, InvoiceWithCustomer } from "@/lib/invoices";
import {
  STATUS_LABELS,
  STATUS_STYLES,
  formatCurrency,
} from "@/lib/invoices/types";
import { invoicesLink } from "@/lib/dashboard/links";

const FILTERS: { id: InvoiceFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "sent", label: "Sent" },
  { id: "overdue", label: "Overdue" },
  { id: "paid", label: "Paid" },
  { id: "void", label: "Void" },
];

type InvoicesClientProps = {
  invoices: InvoiceWithCustomer[];
  initialFilter: InvoiceFilter;
  initialSearch: string;
  openNewInvoice: boolean;
};

export function InvoicesClient({
  invoices,
  initialFilter,
  initialSearch,
  openNewInvoice,
}: InvoicesClientProps) {
  const [filter, setFilter] = useState(initialFilter);
  const [search, setSearch] = useState(initialSearch);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const customerName =
        invoice.customers?.company || invoice.customers?.name || "";
      const matchesFilter =
        filter === "all" ||
        (filter === "sent" &&
          ["sent", "viewed", "partially_paid"].includes(invoice.status)) ||
        invoice.status === filter;

      if (!matchesFilter) return false;
      if (!term) return true;

      return (
        invoice.invoice_number.toLowerCase().includes(term) ||
        customerName.toLowerCase().includes(term) ||
        invoice.status.toLowerCase().includes(term)
      );
    });
  }, [filter, invoices, search]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <Link
              key={item.id}
              href={invoicesLink({
                filter: item.id === "all" ? undefined : item.id,
                search: search || undefined,
              })}
              onClick={() => setFilter(item.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === item.id
                  ? "bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/30"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search invoice #, customer, status…"
            className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/50 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none sm:w-72"
          />
          <Link
            href={invoicesLink({ newInvoice: true })}
            className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
          >
            New invoice
          </Link>
        </div>
      </div>

      {openNewInvoice && (
        <div className="mb-6 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 text-sm text-indigo-200">
          Use the form below or open a completed appointment to start a prefilled draft.
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={
            <svg className="h-6 w-6 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          }
          title="No invoices found"
          description="Create your first invoice or adjust filters to see more results."
          action={
            <Link
              href={invoicesLink({ newInvoice: true })}
              className="inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950"
            >
              Create invoice
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/[0.06]">
              <thead className="bg-zinc-900/80">
                <tr>
                  {["Invoice", "Customer", "Issue date", "Due date", "Status", "Total", "Balance"].map(
                    (heading) => (
                      <th
                        key={heading}
                        className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] bg-zinc-950/40">
                {filtered.map((invoice) => {
                  const customerName =
                    invoice.customers?.company || invoice.customers?.name || "—";
                  return (
                    <tr key={invoice.id} className="transition-colors hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <Link
                          href={invoicesLink({ invoiceId: invoice.id })}
                          className="text-sm font-medium text-white hover:text-indigo-300"
                        >
                          {invoice.invoice_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-300">{customerName}</td>
                      <td className="px-4 py-3 text-sm text-zinc-400">{invoice.issue_date}</td>
                      <td className="px-4 py-3 text-sm text-zinc-400">
                        {invoice.due_date ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${STATUS_STYLES[invoice.status]}`}
                        >
                          {STATUS_LABELS[invoice.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-200">
                        {formatCurrency(invoice.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-200">
                        {formatCurrency(invoice.balance_due)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
