"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/app/components/ui/empty-state";
import { deleteCustomer } from "@/app/dashboard/customers/actions";
import type { Customer } from "@/lib/customers/types";
import { CustomerFormModal } from "./customer-form-modal";

type CustomersClientProps = {
  customers: Customer[];
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function CustomersClient({ customers }: CustomersClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return customers;
    }

    return customers.filter((customer) => {
      const haystack = [
        customer.name,
        customer.company ?? "",
        customer.email ?? "",
        customer.phone ?? "",
        customer.notes ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [customers, search]);

  const openCreateModal = () => {
    setEditingCustomer(null);
    setModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCustomer(null);
  };

  const handleSuccess = () => {
    router.refresh();
  };

  const handleDelete = (customer: Customer) => {
    const confirmed = window.confirm(
      `Delete ${customer.name}? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setDeleteError(null);

    startTransition(async () => {
      const result = await deleteCustomer(customer.id);

      if (result.error) {
        setDeleteError(result.error);
        return;
      }

      router.refresh();
    });
  };

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search customers..."
            className="h-10 w-full rounded-lg border border-white/[0.06] bg-zinc-900/50 pl-9 pr-4 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
          />
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add customer
        </button>
      </div>

      {deleteError && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {deleteError}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/50 backdrop-blur-sm">
        {filteredCustomers.length > 0 && (
          <div className="border-b border-white/[0.06] px-5 py-3">
            <p className="text-xs text-zinc-500">
              {filteredCustomers.length} customer
              {filteredCustomers.length === 1 ? "" : "s"}
              {search.trim() ? " matching search" : ""}
            </p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/[0.06]">
            <thead>
              <tr className="bg-zinc-900/80">
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Customer
                </th>
                <th className="hidden px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:table-cell">
                  Company
                </th>
                <th className="hidden px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 md:table-cell">
                  Email
                </th>
                <th className="hidden px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 lg:table-cell">
                  Phone
                </th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5">
                    <EmptyState
                      icon={
                        <svg
                          className="h-6 w-6 text-zinc-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                          />
                        </svg>
                      }
                      title={
                        customers.length === 0
                          ? "No customers yet"
                          : "No customers match your search"
                      }
                      description={
                        customers.length === 0
                          ? "Add your first customer to start building your CRM."
                          : "Try a different search term."
                      }
                      action={
                        customers.length === 0 ? (
                          <button
                            type="button"
                            onClick={openCreateModal}
                            className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
                          >
                            Add customer
                          </button>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="cursor-pointer transition-colors hover:bg-white/[0.03]"
                    onClick={() => openEditModal(customer)}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.06] bg-zinc-800/80 text-xs font-medium text-zinc-300">
                          {getInitials(customer.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">
                            {customer.name}
                          </p>
                          <p className="truncate text-xs text-zinc-500">
                            {customer.company ||
                              customer.email ||
                              customer.phone ||
                              (customer.notes ? customer.notes : "—")}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden max-w-[10rem] truncate px-5 py-4 text-sm text-zinc-300 sm:table-cell">
                      {customer.company || "—"}
                    </td>
                    <td className="hidden max-w-[12rem] truncate px-5 py-4 text-sm text-zinc-300 md:table-cell">
                      {customer.email || "—"}
                    </td>
                    <td className="hidden whitespace-nowrap px-5 py-4 text-sm text-zinc-300 lg:table-cell">
                      {customer.phone || "—"}
                    </td>
                    <td className="px-5 py-4" onClick={(event) => event.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(customer)}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(customer)}
                          disabled={isPending}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <CustomerFormModal
        key={editingCustomer?.id ?? "create"}
        open={modalOpen}
        customer={editingCustomer}
        onClose={closeModal}
        onSuccess={handleSuccess}
      />
    </>
  );
}
