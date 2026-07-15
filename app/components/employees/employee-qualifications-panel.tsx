"use client";

import { useActionState, type ReactNode } from "react";
import {
  assignEmployeeSkillAction,
  createEmployeeCertificationAction,
  createEmployeeTrainingAction,
  type QualificationActionState,
} from "@/app/dashboard/employees/qualifications-actions";
import { maskCertificateNumber } from "@/lib/qualifications/expiry";
import type {
  BusinessSkill,
  EmployeeCertification,
  EmployeeSkill,
  EmployeeTrainingRecord,
  EmployeeQualificationSummary,
} from "@/lib/qualifications/types";

const inputClassName =
  "w-full rounded-lg border border-white/[0.06] bg-zinc-800/50 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none";

const labelClassName = "mb-1 block text-xs font-medium text-zinc-400";

const STATUS_STYLES: Record<string, string> = {
  valid: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  expiring_soon: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  expired: "bg-rose-500/10 text-rose-300 border-rose-500/20",
  pending_verification: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
  suspended: "bg-orange-500/10 text-orange-300 border-orange-500/20",
  revoked: "bg-rose-500/10 text-rose-300 border-rose-500/20",
};

type EmployeeQualificationsPanelProps = {
  employeeId: string;
  skillsCatalog: BusinessSkill[];
  certifications: EmployeeCertification[];
  skills: EmployeeSkill[];
  training: EmployeeTrainingRecord[];
  summary: EmployeeQualificationSummary | null;
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-zinc-800/20 p-4">
      <h3 className="mb-3 text-sm font-semibold text-white">{title}</h3>
      {children}
    </section>
  );
}

export function EmployeeQualificationsPanel({
  employeeId,
  skillsCatalog,
  certifications,
  skills,
  training,
  summary,
}: EmployeeQualificationsPanelProps) {
  const [, certAction, certPending] = useActionState<
    QualificationActionState,
    FormData
  >(createEmployeeCertificationAction, {});
  const [, skillAction, skillPending] = useActionState<
    QualificationActionState,
    FormData
  >(assignEmployeeSkillAction, {});
  const [, trainingAction, trainingPending] = useActionState<
    QualificationActionState,
    FormData
  >(createEmployeeTrainingAction, {});

  const expiring = certifications.filter((c) => c.status === "expiring_soon");
  const expired = certifications.filter((c) => c.status === "expired");
  const valid = certifications.filter((c) => c.status === "valid");

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Qualification status" value={summary.fullyQualified ? "Fully qualified" : "Gaps found"} />
          <Stat label="Expiring soon" value={String(summary.expiringSoonCount)} />
          <Stat label="Expired" value={String(summary.expiredCount)} />
          <Stat label="Overdue training" value={String(summary.overdueTrainingCount)} />
        </div>
      )}

      <Section title="Skills">
        <ul className="mb-4 space-y-2">
          {skills.length === 0 && (
            <li className="text-sm text-zinc-500">No skills recorded yet.</li>
          )}
          {skills.map((skill) => (
            <li
              key={skill.id}
              className="flex items-center justify-between rounded-lg border border-white/[0.04] px-3 py-2 text-sm"
            >
              <span className="text-white">{skill.business_skills?.name ?? "Skill"}</span>
              <span className="text-zinc-400 capitalize">{skill.proficiency_level}</span>
            </li>
          ))}
        </ul>
        <form action={skillAction} className="grid gap-2 sm:grid-cols-2">
          <input type="hidden" name="employee_id" value={employeeId} />
          <div>
            <label className={labelClassName}>Skill</label>
            <select name="skill_id" className={inputClassName} required>
              <option value="">Select skill…</option>
              {skillsCatalog.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClassName}>Proficiency</label>
            <select name="proficiency_level" className={inputClassName} defaultValue="intermediate">
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={skillPending}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-500 disabled:opacity-50 sm:col-span-2"
          >
            {skillPending ? "Saving…" : "Add skill"}
          </button>
        </form>
      </Section>

      <Section title="Certifications and licences">
        <CertList title="Valid" items={valid} />
        <CertList title="Expiring soon" items={expiring} />
        <CertList title="Expired" items={expired} />

        <form action={certAction} className="mt-4 grid gap-2 sm:grid-cols-2">
          <input type="hidden" name="employee_id" value={employeeId} />
          <div className="sm:col-span-2">
            <label className={labelClassName}>Name</label>
            <input name="name" className={inputClassName} required placeholder="Fall Protection" />
          </div>
          <div>
            <label className={labelClassName}>Type</label>
            <select name="certification_type" className={inputClassName} defaultValue="certification">
              <option value="licence">Licence</option>
              <option value="certification">Certification</option>
              <option value="endorsement">Endorsement</option>
              <option value="medical">Medical</option>
              <option value="orientation">Orientation</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className={labelClassName}>Issuing organization</label>
            <input name="issuing_organization" className={inputClassName} />
          </div>
          <div>
            <label className={labelClassName}>Issue date</label>
            <input type="date" name="issue_date" className={inputClassName} />
          </div>
          <div>
            <label className={labelClassName}>Expiry date</label>
            <input type="date" name="expiry_date" className={inputClassName} />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-300 sm:col-span-2">
            <input type="checkbox" name="does_not_expire" value="true" />
            Does not expire
          </label>
          <button
            type="submit"
            disabled={certPending}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-500 disabled:opacity-50 sm:col-span-2"
          >
            {certPending ? "Saving…" : "Add certification"}
          </button>
        </form>
      </Section>

      <Section title="Training history">
        <ul className="mb-4 space-y-2">
          {training.length === 0 && (
            <li className="text-sm text-zinc-500">No training records yet.</li>
          )}
          {training.map((record) => (
            <li
              key={record.id}
              className="rounded-lg border border-white/[0.04] px-3 py-2 text-sm"
            >
              <p className="font-medium text-white">{record.course_name}</p>
              <p className="text-zinc-400">
                {record.provider ?? "Provider not set"} · {record.result}
                {record.completion_date ? ` · ${record.completion_date}` : ""}
              </p>
            </li>
          ))}
        </ul>
        <form action={trainingAction} className="grid gap-2 sm:grid-cols-2">
          <input type="hidden" name="employee_id" value={employeeId} />
          <div className="sm:col-span-2">
            <label className={labelClassName}>Course</label>
            <input name="course_name" className={inputClassName} required />
          </div>
          <div>
            <label className={labelClassName}>Provider</label>
            <input name="provider" className={inputClassName} />
          </div>
          <div>
            <label className={labelClassName}>Result</label>
            <select name="result" className={inputClassName} defaultValue="passed">
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="incomplete">Incomplete</option>
            </select>
          </div>
          <div>
            <label className={labelClassName}>Completion date</label>
            <input type="date" name="completion_date" className={inputClassName} />
          </div>
          <div>
            <label className={labelClassName}>Renewal / expiry date</label>
            <input type="date" name="expiry_date" className={inputClassName} />
          </div>
          <button
            type="submit"
            disabled={trainingPending}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-500 disabled:opacity-50 sm:col-span-2"
          >
            {trainingPending ? "Saving…" : "Add training record"}
          </button>
        </form>
      </Section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.04] bg-zinc-800/30 px-3 py-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function CertList({
  title,
  items,
}: {
  title: string;
  items: EmployeeCertification[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
        {title}
      </p>
      <ul className="space-y-2">
        {items.map((cert) => (
          <li
            key={cert.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.04] px-3 py-2 text-sm"
          >
            <div>
              <p className="font-medium text-white">{cert.name}</p>
              <p className="text-xs text-zinc-500">
                {cert.issuing_organization ?? "—"}
                {cert.expiry_date ? ` · expires ${cert.expiry_date}` : " · no expiry"}
                {cert.certificate_number
                  ? ` · ${maskCertificateNumber(cert.certificate_number)}`
                  : ""}
              </p>
            </div>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[cert.status] ?? STATUS_STYLES.valid}`}
            >
              {cert.status.replace(/_/g, " ")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
