"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/app/components/ui/empty-state";
import {
  archiveEmployee,
  deleteEmployee,
} from "@/app/dashboard/employees/actions";
import type { EmployeeFocus } from "@/lib/dashboard/links";
import type { EmployeeListStats } from "@/lib/employees";
import type { Employee } from "@/lib/employees/types";
import type { EmployeeQualificationListMeta } from "@/lib/qualifications/types";
import { EmployeeAvatar } from "./employee-avatar";
import { EmployeeFormModal } from "./employee-form-modal";
import { EmployeeQualificationBadges } from "./employee-qualification-badges";
import { EmployeeStatusBadge } from "./employee-status-badge";
import { EmployeeWorkloadBar } from "./employee-workload-bar";

type QualificationFilter =
  | "all"
  | "fully_qualified"
  | "missing_requirement"
  | "certification_expiring"
  | "certification_expired"
  | "training_overdue";

type EmployeesClientProps = {
  employees: Employee[];
  statsByEmployeeId: Record<string, EmployeeListStats>;
  initialFocus?: EmployeeFocus;
  openNewEmployee?: boolean;
  qualificationMetaByEmployeeId?: Record<string, EmployeeQualificationListMeta>;
};

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/[0.04] bg-zinc-800/30 px-3 py-2">
      <p className="text-lg font-semibold tabular-nums text-white">{value}</p>
      <p className="text-[10px] text-zinc-500">{label}</p>
    </div>
  );
}

export function EmployeesClient({
  employees,
  statsByEmployeeId,
  initialFocus,
  openNewEmployee = false,
  qualificationMetaByEmployeeId = {},
}: EmployeesClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showQualificationFilters, setShowQualificationFilters] = useState(false);
  const [qualificationFilter, setQualificationFilter] =
    useState<QualificationFilter>("all");
  const [skillFilter, setSkillFilter] = useState("");
  const [certificationTypeFilter, setCertificationTypeFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (openNewEmployee) {
      setEditingEmployee(null);
      setModalOpen(true);
    }
  }, [openNewEmployee]);

  const availableSkills = useMemo(() => {
    const names = new Set<string>();
    for (const meta of Object.values(qualificationMetaByEmployeeId)) {
      for (const skill of meta.skillNames) {
        names.add(skill);
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [qualificationMetaByEmployeeId]);

  const availableCertificationTypes = useMemo(() => {
    const types = new Set<string>();
    for (const meta of Object.values(qualificationMetaByEmployeeId)) {
      for (const type of meta.certificationTypes) {
        types.add(type);
      }
    }
    return [...types].sort((a, b) => a.localeCompare(b));
  }, [qualificationMetaByEmployeeId]);

  const hasQualificationData = Object.keys(qualificationMetaByEmployeeId).length > 0;

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    const matches = employees.filter((employee) => {
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

    const qualificationFiltered = matches.filter((employee) => {
      const meta = qualificationMetaByEmployeeId[employee.id];
      if (!meta) {
        return qualificationFilter === "all" && !skillFilter && !certificationTypeFilter;
      }

      if (skillFilter && !meta.skillNames.includes(skillFilter)) {
        return false;
      }

      if (
        certificationTypeFilter &&
        !meta.certificationTypes.includes(certificationTypeFilter)
      ) {
        return false;
      }

      switch (qualificationFilter) {
        case "fully_qualified":
          return meta.fullyQualified && meta.expiredCount === 0;
        case "missing_requirement":
          return meta.missingRequirementCount > 0;
        case "certification_expiring":
          return meta.expiringSoonCount > 0;
        case "certification_expired":
          return meta.expiredCount > 0;
        case "training_overdue":
          return meta.overdueTrainingCount > 0;
        default:
          return true;
      }
    });

    if (initialFocus === "workload") {
      return [...qualificationFiltered].sort((left, right) => {
        const leftWorkload =
          statsByEmployeeId[left.id]?.workloadPercentage ?? 0;
        const rightWorkload =
          statsByEmployeeId[right.id]?.workloadPercentage ?? 0;
        return rightWorkload - leftWorkload;
      });
    }

    return qualificationFiltered;
  }, [
    employees,
    search,
    showArchived,
    initialFocus,
    statsByEmployeeId,
    qualificationFilter,
    skillFilter,
    certificationTypeFilter,
    qualificationMetaByEmployeeId,
  ]);

  const activeCount = useMemo(
    () => employees.filter((employee) => employee.status === "active").length,
    [employees],
  );

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

  const emptyStats: EmployeeListStats = {
    appointmentsToday: 0,
    upcomingAppointments: 0,
    openTasks: 0,
    completedTasks: 0,
    workloadPercentage: 0,
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
          {hasQualificationData && (
            <button
              type="button"
              onClick={() => setShowQualificationFilters((value) => !value)}
              className={`inline-flex h-10 items-center rounded-lg border px-3 text-sm transition-colors ${
                showQualificationFilters
                  ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-200"
                  : "border-white/[0.06] text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Qualification filters
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
        >
          Add employee
        </button>
      </div>

      {showQualificationFilters && hasQualificationData && (
        <div className="mb-4 rounded-xl border border-white/[0.06] bg-zinc-900/40 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-xs text-zinc-400">
              Status
              <select
                value={qualificationFilter}
                onChange={(event) =>
                  setQualificationFilter(event.target.value as QualificationFilter)
                }
                className="mt-1 h-9 w-full rounded-lg border border-white/[0.06] bg-zinc-800/50 px-3 text-sm text-white"
              >
                <option value="all">All employees</option>
                <option value="fully_qualified">Fully qualified</option>
                <option value="missing_requirement">Missing requirement</option>
                <option value="certification_expiring">Certification expiring</option>
                <option value="certification_expired">Certification expired</option>
                <option value="training_overdue">Training overdue</option>
              </select>
            </label>
            <label className="block text-xs text-zinc-400">
              Skill
              <select
                value={skillFilter}
                onChange={(event) => setSkillFilter(event.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-white/[0.06] bg-zinc-800/50 px-3 text-sm text-white"
              >
                <option value="">Any skill</option>
                {availableSkills.map((skill) => (
                  <option key={skill} value={skill}>
                    {skill}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-zinc-400">
              Certification type
              <select
                value={certificationTypeFilter}
                onChange={(event) => setCertificationTypeFilter(event.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-white/[0.06] bg-zinc-800/50 px-3 text-sm text-white"
              >
                <option value="">Any type</option>
                {availableCertificationTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      {initialFocus === "workload" && (
        <div className="mb-4 rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 text-sm text-indigo-200">
          Sorted by team workload — highest capacity first
        </div>
      )}

      {actionError && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {actionError}
        </div>
      )}

      {filteredEmployees.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
          <span>
            {filteredEmployees.length} employee
            {filteredEmployees.length === 1 ? "" : "s"}
            {search.trim() ? " matching search" : ""}
          </span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">
            {activeCount} active team member{activeCount === 1 ? "" : "s"}
          </span>
        </div>
      )}

      {filteredEmployees.length === 0 ? (
        <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/50 backdrop-blur-sm">
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
            title={
              employees.length === 0
                ? "No employees yet"
                : "No employees match your filters"
            }
            description={
              employees.length === 0
                ? "Add your first team member to start assigning work."
                : "Try a different search term or show archived employees."
            }
            action={
              employees.length === 0 ? (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
                >
                  Add employee
                </button>
              ) : undefined
            }
          />
        </section>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredEmployees.map((employee) => {
            const stats = statsByEmployeeId[employee.id] ?? emptyStats;
            const qualificationMeta = qualificationMetaByEmployeeId[employee.id];
            const showQualificationBadges =
              showQualificationFilters && qualificationMeta;

            return (
              <article
                key={employee.id}
                className="group flex flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/50 backdrop-blur-sm transition-colors hover:border-white/[0.12] hover:bg-zinc-900/70"
              >
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/dashboard/employees/${employee.id}`)
                  }
                  className="flex flex-1 flex-col p-5 text-left"
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-full ring-2 ring-white/[0.06] ring-offset-2 ring-offset-zinc-900/50 transition-colors group-hover:ring-indigo-500/30">
                      <EmployeeAvatar employee={employee} size="lg" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-semibold text-white">
                          {employee.full_name}
                        </h2>
                        <EmployeeStatusBadge status={employee.status} />
                      </div>
                      <p className="mt-0.5 truncate text-sm text-zinc-400">
                        {employee.position || "Team member"}
                      </p>
                      {(employee.email || employee.phone) && (
                        <p className="mt-1 truncate text-xs text-zinc-500">
                          {employee.email || employee.phone}
                        </p>
                      )}
                      {showQualificationBadges && (
                        <EmployeeQualificationBadges
                          meta={qualificationMeta}
                          compact
                        />
                      )}
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-4 gap-2">
                    <MiniStat label="Today" value={stats.appointmentsToday} />
                    <MiniStat label="Upcoming" value={stats.upcomingAppointments} />
                    <MiniStat label="Open tasks" value={stats.openTasks} />
                    <MiniStat label="Done" value={stats.completedTasks} />
                  </div>

                  <div className="mt-4">
                    <EmployeeWorkloadBar
                      percentage={stats.workloadPercentage}
                      size="sm"
                    />
                  </div>
                </button>

                <div
                  className="flex items-center justify-end gap-1 border-t border-white/[0.06] px-3 py-2"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Link
                    href={`/dashboard/employees/${employee.id}`}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    View profile
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
              </article>
            );
          })}
        </div>
      )}

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
