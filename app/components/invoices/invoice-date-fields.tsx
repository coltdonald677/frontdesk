"use client";

import { DatePickerPopover } from "@/app/components/invoices/date-picker-popover";
import {
  PAYMENT_TERM_OPTIONS,
  formatShortInvoiceDate,
  getPaymentTermLabel,
  type PaymentTerm,
} from "@/lib/invoices/invoice-dates";

type InvoiceDateFieldsProps = {
  issueDate: string;
  dueDate: string;
  paymentTerm: PaymentTerm;
  onIssueDateChange: (isoDate: string) => void;
  onDueDateChange: (isoDate: string) => void;
  onPaymentTermChange: (term: PaymentTerm) => void;
  dateError?: string | null;
  disabled?: boolean;
};

const labelClassName =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500";

const termButtonClassName = (active: boolean) =>
  `rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
    active
      ? "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/30"
      : "border border-white/[0.06] text-zinc-400 hover:border-white/[0.12] hover:bg-white/5 hover:text-zinc-200"
  }`;

export function InvoiceDateFields({
  issueDate,
  dueDate,
  paymentTerm,
  onIssueDateChange,
  onDueDateChange,
  onPaymentTermChange,
  dateError,
  disabled = false,
}: InvoiceDateFieldsProps) {
  const isCustomDue = paymentTerm === "custom";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClassName}>Issue date</label>
          <DatePickerPopover
            label="Issue date"
            value={issueDate}
            onChange={onIssueDateChange}
            disabled={disabled}
            showDayNav
          />
        </div>

        <div>
          <label className={labelClassName}>Due date</label>
          {isCustomDue ? (
            <DatePickerPopover
              label="Due date"
              value={dueDate}
              onChange={onDueDateChange}
              disabled={disabled}
              minDate={issueDate}
            />
          ) : (
            <div className="flex h-[38px] items-center rounded-lg border border-white/[0.06] bg-zinc-950/30 px-3 text-sm text-zinc-200">
              {dueDate ? formatShortInvoiceDate(dueDate) : "—"}
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <label className={labelClassName}>Payment terms</label>
          <span className="text-[11px] text-indigo-300/90">
            {getPaymentTermLabel(paymentTerm)}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PAYMENT_TERM_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => onPaymentTermChange(option.id)}
              className={termButtonClassName(paymentTerm === option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {dateError && (
        <p className="text-xs text-rose-400" role="alert">
          {dateError}
        </p>
      )}
    </div>
  );
}
