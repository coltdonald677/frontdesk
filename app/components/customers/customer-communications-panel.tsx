"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { EmptyState } from "@/app/components/ui/empty-state";
import { RichTextContent, RichTextEditor } from "@/app/components/communications/rich-text-editor";
import {
  createCommunicationEmail,
  createCommunicationNote,
  createPhoneCallLog,
  getAttachmentDownloadUrlAction,
  getCustomerCommunicationsAction,
  uploadCommunicationAttachment,
  type CommunicationActionState,
} from "@/app/dashboard/customers/communications-actions";
import {
  ATTACHMENT_CATEGORIES,
  ATTACHMENT_CATEGORY_LABELS,
  DIRECTION_LABELS,
  EMAIL_DIRECTIONS,
  OUTCOME_LABELS,
  PHONE_CALL_OUTCOMES,
  PROVIDER_LABELS,
  SYNC_STATUS_LABELS,
  type CustomerCommunicationsHub,
} from "@/lib/communications/types";
import {
  formatDuration,
  formatFileSize,
  toDatetimeLocalValue,
} from "@/lib/communications/format";
import type { Employee } from "@/lib/employees/types";
import { workspaceListClass } from "../customers/panel-styles";

const inputClassName =
  "w-full rounded-lg border border-white/[0.06] bg-zinc-800/50 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50";

const labelClassName = "mb-1.5 block text-sm font-medium text-zinc-300";

type HubSection = "notes" | "calls" | "emails" | "attachments";

const SECTIONS: { id: HubSection; label: string }[] = [
  { id: "notes", label: "Notes" },
  { id: "calls", label: "Phone calls" },
  { id: "emails", label: "Emails" },
  { id: "attachments", label: "Attachments" },
];

type CustomerCommunicationsPanelProps = {
  customerId: string;
  customerEmail: string | null;
  employees: Employee[];
  initialHub: CustomerCommunicationsHub;
};

function formatTimestamp(isoDate: string) {
  return new Date(isoDate).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CustomerCommunicationsPanel({
  customerId,
  customerEmail,
  employees,
  initialHub,
}: CustomerCommunicationsPanelProps) {
  const [section, setSection] = useState<HubSection>("notes");
  const [hub, setHub] = useState(initialHub);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, startLoadTransition] = useTransition();

  const reloadHub = () => {
    startLoadTransition(async () => {
      const result = await getCustomerCommunicationsAction(customerId);
      if (result.error) {
        setLoadError(result.error);
        return;
      }
      setLoadError(null);
      if (result.hub) {
        setHub(result.hub);
      }
    });
  };

  useEffect(() => {
    setHub(initialHub);
  }, [initialHub]);

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-white/[0.06] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h3 className="text-sm font-semibold text-white">Communications Hub</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Notes, calls, emails, and files — synced into the customer timeline.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((current) => !current)}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add {SECTIONS.find((item) => item.id === section)?.label.toLowerCase().replace(/s$/, "") ?? "entry"}
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-white/[0.06] px-4 sm:px-6">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setSection(item.id);
              setShowForm(false);
            }}
            className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
              section === item.id
                ? "border-indigo-400 text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {item.label}
            <span className="ml-1.5 text-xs text-zinc-600">
              ({hub[item.id].length})
            </span>
          </button>
        ))}
      </div>

      {showForm && section === "notes" && (
        <NoteForm
          customerId={customerId}
          employees={employees}
          onSuccess={() => {
            setShowForm(false);
            reloadHub();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {showForm && section === "calls" && (
        <CallForm
          customerId={customerId}
          employees={employees}
          onSuccess={() => {
            setShowForm(false);
            reloadHub();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {showForm && section === "emails" && (
        <EmailForm
          customerId={customerId}
          customerEmail={customerEmail}
          employees={employees}
          onSuccess={() => {
            setShowForm(false);
            reloadHub();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {showForm && section === "attachments" && (
        <AttachmentForm
          customerId={customerId}
          onSuccess={() => {
            setShowForm(false);
            reloadHub();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className={workspaceListClass}>
        {loadError && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {loadError}
          </div>
        )}

        {isLoading && (
          <p className="py-8 text-center text-sm text-zinc-500">Refreshing…</p>
        )}

        {!isLoading && section === "notes" && (
          <NotesList notes={hub.notes} onAdd={() => setShowForm(true)} />
        )}

        {!isLoading && section === "calls" && (
          <CallsList calls={hub.calls} onAdd={() => setShowForm(true)} />
        )}

        {!isLoading && section === "emails" && (
          <EmailsList emails={hub.emails} onAdd={() => setShowForm(true)} />
        )}

        {!isLoading && section === "attachments" && (
          <AttachmentsList
            attachments={hub.attachments}
            onAdd={() => setShowForm(true)}
          />
        )}
      </div>
    </div>
  );
}

function FormShell({
  title,
  children,
  onCancel,
  pending,
  submitLabel,
  error,
}: {
  title: string;
  children: ReactNode;
  onCancel: () => void;
  pending: boolean;
  submitLabel: string;
  error?: string;
}) {
  return (
    <div className="space-y-4 border-b border-white/[0.06] px-5 py-5 sm:px-6">
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      {children}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}

function NoteForm({
  customerId,
  employees,
  onSuccess,
  onCancel,
}: {
  customerId: string;
  employees: Employee[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    CommunicationActionState,
    FormData
  >(createCommunicationNote, {});
  const handled = useRef(false);

  useEffect(() => {
    if (state.success && !handled.current) {
      handled.current = true;
      onSuccess();
    }
    if (!state.success) handled.current = false;
  }, [state.success, onSuccess]);

  return (
    <form action={formAction}>
      <FormShell
        title="New note"
        onCancel={onCancel}
        pending={pending}
        submitLabel="Save note"
        error={state.error}
      >
        <input type="hidden" name="customer_id" value={customerId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="note_title" className={labelClassName}>
              Title (optional)
            </label>
            <input id="note_title" name="title" className={inputClassName} placeholder="Follow-up summary" />
          </div>
          <div>
            <label htmlFor="note_employee" className={labelClassName}>
              Author
            </label>
            <select id="note_employee" name="employee_id" className={`${inputClassName} cursor-pointer`} defaultValue="">
              <option value="" className="bg-zinc-900">Unassigned</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id} className="bg-zinc-900">
                  {employee.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelClassName}>Note</label>
          <RichTextEditor name="body_html" placeholder="Capture context, decisions, and next steps…" />
        </div>
      </FormShell>
    </form>
  );
}

function CallForm({
  customerId,
  employees,
  onSuccess,
  onCancel,
}: {
  customerId: string;
  employees: Employee[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    CommunicationActionState,
    FormData
  >(createPhoneCallLog, {});
  const handled = useRef(false);

  useEffect(() => {
    if (state.success && !handled.current) {
      handled.current = true;
      onSuccess();
    }
    if (!state.success) handled.current = false;
  }, [state.success, onSuccess]);

  return (
    <form action={formAction}>
      <FormShell
        title="Log phone call"
        onCancel={onCancel}
        pending={pending}
        submitLabel="Save call"
        error={state.error}
      >
        <input type="hidden" name="customer_id" value={customerId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="call_occurred_at" className={labelClassName}>
              Date & time
            </label>
            <input
              id="call_occurred_at"
              name="occurred_at"
              type="datetime-local"
              required
              defaultValue={toDatetimeLocalValue()}
              className={inputClassName}
            />
          </div>
          <div>
            <label htmlFor="call_employee" className={labelClassName}>
              Employee
            </label>
            <select id="call_employee" name="employee_id" className={`${inputClassName} cursor-pointer`} defaultValue="">
              <option value="" className="bg-zinc-900">Unassigned</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id} className="bg-zinc-900">
                  {employee.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="duration_minutes" className={labelClassName}>
              Duration (minutes)
            </label>
            <input
              id="duration_minutes"
              name="duration_minutes"
              type="number"
              min={0}
              step={1}
              defaultValue={5}
              className={inputClassName}
            />
          </div>
          <div>
            <label htmlFor="outcome" className={labelClassName}>
              Outcome
            </label>
            <select id="outcome" name="outcome" className={`${inputClassName} cursor-pointer`} defaultValue="connected">
              {PHONE_CALL_OUTCOMES.map((outcome) => (
                <option key={outcome} value={outcome} className="bg-zinc-900">
                  {OUTCOME_LABELS[outcome]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            name="follow_up_required"
            className="rounded border-white/10 bg-zinc-800 text-indigo-500 focus:ring-indigo-500/50"
          />
          Follow-up required
        </label>
        <div>
          <label htmlFor="summary" className={labelClassName}>
            Summary (optional)
          </label>
          <textarea
            id="summary"
            name="summary"
            rows={3}
            className={`${inputClassName} resize-none`}
            placeholder="What was discussed?"
          />
        </div>
      </FormShell>
    </form>
  );
}

function EmailForm({
  customerId,
  customerEmail,
  employees,
  onSuccess,
  onCancel,
}: {
  customerId: string;
  customerEmail: string | null;
  employees: Employee[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    CommunicationActionState,
    FormData
  >(createCommunicationEmail, {});
  const handled = useRef(false);

  useEffect(() => {
    if (state.success && !handled.current) {
      handled.current = true;
      onSuccess();
    }
    if (!state.success) handled.current = false;
  }, [state.success, onSuccess]);

  return (
    <form action={formAction}>
      <FormShell
        title="Log email"
        onCancel={onCancel}
        pending={pending}
        submitLabel="Save email"
        error={state.error}
      >
        <input type="hidden" name="customer_id" value={customerId} />
        <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-xs text-sky-200/90">
          Manual entry for now. Gmail and Outlook sync will populate this same history later.
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="direction" className={labelClassName}>
              Direction
            </label>
            <select id="direction" name="direction" className={`${inputClassName} cursor-pointer`} defaultValue="outbound">
              {EMAIL_DIRECTIONS.map((direction) => (
                <option key={direction} value={direction} className="bg-zinc-900">
                  {DIRECTION_LABELS[direction]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="email_occurred_at" className={labelClassName}>
              Date & time
            </label>
            <input
              id="email_occurred_at"
              name="occurred_at"
              type="datetime-local"
              defaultValue={toDatetimeLocalValue()}
              className={inputClassName}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="subject" className={labelClassName}>
              Subject
            </label>
            <input id="subject" name="subject" required className={inputClassName} placeholder="Re: Service quote" />
          </div>
          <div>
            <label htmlFor="from_address" className={labelClassName}>
              From
            </label>
            <input id="from_address" name="from_address" required className={inputClassName} />
          </div>
          <div>
            <label htmlFor="to_addresses" className={labelClassName}>
              To
            </label>
            <input
              id="to_addresses"
              name="to_addresses"
              required
              defaultValue={customerEmail ?? ""}
              className={inputClassName}
              placeholder="customer@example.com"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="cc_addresses" className={labelClassName}>
              CC (optional)
            </label>
            <input id="cc_addresses" name="cc_addresses" className={inputClassName} placeholder="Separate with commas" />
          </div>
          <div>
            <label htmlFor="email_employee" className={labelClassName}>
              Logged by
            </label>
            <select id="email_employee" name="employee_id" className={`${inputClassName} cursor-pointer`} defaultValue="">
              <option value="" className="bg-zinc-900">Unassigned</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id} className="bg-zinc-900">
                  {employee.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelClassName}>Body</label>
          <RichTextEditor name="body_html" placeholder="Paste or write the email content…" minHeight="10rem" />
        </div>
      </FormShell>
    </form>
  );
}

function AttachmentForm({
  customerId,
  onSuccess,
  onCancel,
}: {
  customerId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    CommunicationActionState,
    FormData
  >(uploadCommunicationAttachment, {});
  const handled = useRef(false);

  useEffect(() => {
    if (state.success && !handled.current) {
      handled.current = true;
      onSuccess();
    }
    if (!state.success) handled.current = false;
  }, [state.success, onSuccess]);

  return (
    <form action={formAction} encType="multipart/form-data">
      <FormShell
        title="Upload attachment"
        onCancel={onCancel}
        pending={pending}
        submitLabel="Upload file"
        error={state.error}
      >
        <input type="hidden" name="customer_id" value={customerId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="category" className={labelClassName}>
              Category
            </label>
            <select id="category" name="category" className={`${inputClassName} cursor-pointer`} defaultValue="document">
              {ATTACHMENT_CATEGORIES.map((category) => (
                <option key={category} value={category} className="bg-zinc-900">
                  {ATTACHMENT_CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="file" className={labelClassName}>
              File
            </label>
            <input
              id="file"
              name="file"
              type="file"
              required
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
              className={`${inputClassName} file:mr-3 file:rounded-md file:border-0 file:bg-zinc-700 file:px-3 file:py-1 file:text-xs file:font-medium file:text-white`}
            />
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          Photos, PDFs, invoices, and documents up to 25 MB.
        </p>
      </FormShell>
    </form>
  );
}

function NotesList({
  notes,
  onAdd,
}: {
  notes: CustomerCommunicationsHub["notes"];
  onAdd: () => void;
}) {
  if (notes.length === 0) {
    return (
      <EmptyState
        compact
        icon={<NoteIcon />}
        title="No notes yet"
        description="Add rich-text notes that appear on the customer timeline."
        action={
          <button type="button" onClick={onAdd} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200">
            Add note
          </button>
        }
      />
    );
  }

  return (
    <ul className="space-y-3">
      {notes.map((note) => (
        <li key={note.id} className="rounded-xl border border-white/[0.06] bg-zinc-800/25 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-white">
              {note.title || "Note"}
            </span>
            {note.employees?.full_name && (
              <span className="text-xs text-zinc-500">· {note.employees.full_name}</span>
            )}
            <time dateTime={note.occurred_at} className="ml-auto text-xs text-zinc-500">
              {formatTimestamp(note.occurred_at)}
            </time>
          </div>
          {note.note && <RichTextContent html={note.note.body_html} className="mt-3" />}
        </li>
      ))}
    </ul>
  );
}

function CallsList({
  calls,
  onAdd,
}: {
  calls: CustomerCommunicationsHub["calls"];
  onAdd: () => void;
}) {
  if (calls.length === 0) {
    return (
      <EmptyState
        compact
        icon={<CallIcon />}
        title="No calls logged"
        description="Track who called, how long, and whether follow-up is needed."
        action={
          <button type="button" onClick={onAdd} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200">
            Log call
          </button>
        }
      />
    );
  }

  return (
    <ul className="space-y-3">
      {calls.map((call) => (
        <li key={call.id} className="rounded-xl border border-white/[0.06] bg-zinc-800/25 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
              {call.call ? OUTCOME_LABELS[call.call.outcome] : "Call"}
            </span>
            {call.call?.follow_up_required && (
              <span className="inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                Follow-up required
              </span>
            )}
            <time dateTime={call.occurred_at} className="ml-auto text-xs text-zinc-500">
              {formatTimestamp(call.occurred_at)}
            </time>
          </div>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-zinc-500">Employee</dt>
              <dd className="text-zinc-200">{call.employees?.full_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Duration</dt>
              <dd className="text-zinc-200">
                {call.call ? formatDuration(call.call.duration_seconds) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Outcome</dt>
              <dd className="text-zinc-200">
                {call.call ? OUTCOME_LABELS[call.call.outcome] : "—"}
              </dd>
            </div>
          </dl>
          {call.call?.summary && (
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">{call.call.summary}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

function EmailsList({
  emails,
  onAdd,
}: {
  emails: CustomerCommunicationsHub["emails"];
  onAdd: () => void;
}) {
  if (emails.length === 0) {
    return (
      <EmptyState
        compact
        icon={<EmailIcon />}
        title="No emails yet"
        description="Log emails manually today — Gmail and Outlook will sync here later."
        action={
          <button type="button" onClick={onAdd} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200">
            Log email
          </button>
        }
      />
    );
  }

  return (
    <ul className="space-y-3">
      {emails.map((email) => (
        <li key={email.id} className="rounded-xl border border-white/[0.06] bg-zinc-800/25 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-300">
              {email.email ? DIRECTION_LABELS[email.email.direction] : "Email"}
            </span>
            {email.email && (
              <span className="text-[11px] text-zinc-500">
                {PROVIDER_LABELS[email.email.provider]} · {SYNC_STATUS_LABELS[email.email.sync_status]}
              </span>
            )}
            <time dateTime={email.occurred_at} className="ml-auto text-xs text-zinc-500">
              {formatTimestamp(email.occurred_at)}
            </time>
          </div>
          <p className="mt-2 text-sm font-semibold text-white">
            {email.email?.subject ?? email.title ?? "Email"}
          </p>
          {email.email && (
            <p className="mt-1 text-xs text-zinc-500">
              {email.email.from_address} → {email.email.to_addresses.join(", ")}
            </p>
          )}
          {email.email?.body_html ? (
            <RichTextContent html={email.email.body_html} className="mt-3" />
          ) : email.email?.body_preview ? (
            <p className="mt-3 text-sm text-zinc-300">{email.email.body_preview}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function AttachmentsList({
  attachments,
  onAdd,
}: {
  attachments: CustomerCommunicationsHub["attachments"];
  onAdd: () => void;
}) {
  const handleDownload = async (attachmentId: string) => {
    const result = await getAttachmentDownloadUrlAction(attachmentId);
    if (result.url) {
      window.open(result.url, "_blank", "noopener,noreferrer");
    }
  };

  if (attachments.length === 0) {
    return (
      <EmptyState
        compact
        icon={<AttachmentIcon />}
        title="No attachments"
        description="Upload photos, PDFs, invoices, and documents for this customer."
        action={
          <button type="button" onClick={onAdd} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200">
            Upload file
          </button>
        }
      />
    );
  }

  return (
    <ul className="space-y-2">
      {attachments.map((attachment) => (
        <li
          key={attachment.id}
          className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-zinc-800/25 px-4 py-3"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-zinc-900/60 text-zinc-400">
            <AttachmentIcon />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{attachment.file_name}</p>
            <p className="text-xs text-zinc-500">
              {ATTACHMENT_CATEGORY_LABELS[attachment.category]} · {formatFileSize(attachment.file_size)} · {formatTimestamp(attachment.created_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleDownload(attachment.id)}
            className="shrink-0 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-indigo-500/30 hover:text-white"
          >
            Open
          </button>
        </li>
      ))}
    </ul>
  );
}

function NoteIcon() {
  return (
    <svg className="h-5 w-5 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function CallIcon() {
  return (
    <svg className="h-5 w-5 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg className="h-5 w-5 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function AttachmentIcon() {
  return (
    <svg className="h-5 w-5 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.432 18.44a2.25 2.25 0 003.182 3.182l7.875-7.875a.75.75 0 011.06 1.06l-7.875 7.875a3.75 3.75 0 11-5.303-5.303l10.061-10.06a4.5 4.5 0 015.657 5.657L9.927 19.93a6 6 0 01-8.485-8.485l11.314-11.313" />
    </svg>
  );
}
