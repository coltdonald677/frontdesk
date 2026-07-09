"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/app/components/ui/empty-state";
import {
  archiveEmployee,
  deleteEmployee,
} from "@/app/dashboard/employees/actions";
import type { Employee } from "@/lib/employees/types";
import { EmployeeAvatar } from "./employee-avatar";
import { EmployeeFormModal } from "./employee-form-modal";
import { EmployeeStatusBadge } from "./employee-status-badge";

type EmployeesClientProps = {
  employees: Employee[];
};

export function EmployeesClient({ employees }: EmployeesClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    return employees.filter((employee) => {
      if (!showArchived && employee.status === "inactive") {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        employee.full_name,
        employee.email ?? "",
        employee.phone ?? "",
        employee.position ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [employees, search, showArchived]);

  const openCreateModal = () => {
    setEditingEmployee(null);
    setModalOpen(true);
  };

  const openEditModal = (employee: Employee) => {
    setEditingEmployee(employee);
    setModalOpen(true);
  };

  const handleArchive = (employee: Employee) => {
    const confirmed = window.confirm(
      `Archive ${employee.full_name}? They will be marked inactive and hidden from assignment lists.`,
    );

    if (!confirmed) return;

    setActionError(null);
    startTransition(async () => {
      const result = await archiveEmployee(employee.id);
      if (result.error) {
        setActionError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const handleDelete = (employee: Employee) => {
    const confirmed = window.confirm(
      `Delete ${employee.full_name}? This cannot be undone.`,
    );

    if (!confirmed) return;

    setActionError(null);
    startTransition(async () => {
      const result = await deleteEmployee(employee.id);
      if (result.error) {
        setActionError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
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
              placeholder="Search employees..."
              className="h-10 w-full rounded-lg border border-white/[0.06] bg-zinc-900/50 pl-9 pr-4 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
              className="rounded border-white/20 bg-zinc-900 text-indigo-500 focus:ring-indigo-500/50"
            />
            Show archived
          </label>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
        >
          Add employee
        </button>
      </div>

      {actionError && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {actionError}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/50 backdrop-blur-sm">
        {filteredEmployees.length > 0 && (
          <div className="border-b border-white/[0.06] px-5 py-3">
            <p className="text-xs text-zinc-500">
              {filteredEmployees.length} employee
              {filteredEmployees.length === 1 ? "" : "s"}
            </p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/[0.06]">
            <thead>
              <tr className="bg-zinc-900/80">
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Employee
                </th>
                <th className="hidden px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 md:table-cell">
                  Position
                </th>
                <th className="hidden px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 lg:table-cell">
                  Contact
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Status
                </th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filteredEmployees.length === 0 ? (
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
                            d="M18 18.72a9.09 9.09 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                          />
                        </svg>
                      }
                      title="No employees yet"
                      description="Add your first team member to start assigning work."
                      action={
                        <button
                          type="button"
                          onClick={openCreateModal}
                          className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
                        >
                          Add employee
                        </button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee) => (
                  <tr
                    key={employee.id}
                    className="cursor-pointer transition-colors hover:bg-white/[0.03]"
                    onClick={() => router.push(`/dashboard/employees/${employee.id}`)}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <EmployeeAvatar employee={employee} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">
                            {employee.full_name}
                          </p>
                          <p className="truncate text-xs text-zinc-500">
                            {employee.position || employee.email || "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-5 py-4 text-sm text-zinc-300 md:table-cell">
                      {employee.position || "—"}
                    </td>
                    <td className="hidden px-5 py-4 text-sm text-zinc-300 lg:table-cell">
                      {employee.email || employee.phone || "—"}
                    </td>
                    <td className="px-5 py-4">
                      <EmployeeStatusBadge status={employee.status} />
                    </td>
                    <td
                      className="px-5 py-4"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/employees/${employee.id}`}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
                        >
                          View
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEditModal(employee)}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
                        >
                          Edit
                        </button>
                        {employee.status === "active" && (
                          <button
                            type="button"
                            onClick={() => handleArchive(employee)}
                            disabled={isPending}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/10 disabled:opacity-50"
                          >
                            Archive
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(employee)}
                          disabled={isPending}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
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

      <EmployeeFormModal
        key={editingEmployee?.id ?? "create"}
        open={modalOpen}
        employee={editingEmployee}
        onClose={() => {
          setModalOpen(false);
          setEditingEmployee(null);
        }}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
