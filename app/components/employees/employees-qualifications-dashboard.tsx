"use client";

import Link from "next/link";
import type { QualificationRequirement } from "@/lib/qualifications/types";

type EmployeesQualificationsDashboardProps = {
  requirements: QualificationRequirement[];
  expiringCertifications: Array<{
    id: string;
    name: string;
    expiry_date: string | null;
    employee_name: string;
    employee_id: string;
    status: string;
  }>;
};

export function EmployeesQualificationsDashboard({
  requirements,
  expiringCertifications,
}: EmployeesQualificationsDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-white/[0.06] bg-zinc-800/20 p-4">
          <h2 className="text-sm font-semibold text-white">Expiring within 30 days</h2>
          {expiringCertifications.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No certifications expiring soon.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {expiringCertifications.map((cert) => (
                <li
                  key={cert.id}
                  className="flex items-center justify-between rounded-lg border border-white/[0.04] px-3 py-2 text-sm"
                >
                  <div>
                    <p className="text-white">{cert.name}</p>
                    <p className="text-xs text-zinc-500">
                      {cert.employee_name} · {cert.expiry_date}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/employees/${cert.employee_id}?tab=qualifications`}
                    className="text-xs text-indigo-300 hover:text-indigo-200"
                  >
                    View
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-white/[0.06] bg-zinc-800/20 p-4">
          <h2 className="text-sm font-semibold text-white">Job requirements</h2>
          {requirements.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">
              No reusable job requirements defined yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {requirements.map((req) => (
                <li
                  key={req.id}
                  className="rounded-lg border border-white/[0.04] px-3 py-2 text-sm"
                >
                  <p className="font-medium text-white">{req.name}</p>
                  <p className="text-xs text-zinc-500">
                    {(req.applies_to_entry_types ?? []).join(", ") || "All entry types"}
                    {" · "}
                    {(req.items ?? []).length} rule(s)
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
