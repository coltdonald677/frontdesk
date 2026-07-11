"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { recordPaymentAction, type InvoiceActionState } from "@/app/dashboard/invoices/actions";
import { formatCurrency } from "@/lib/invoices/types";
import { getTodayIsoDate } from "@/lib/appointments/datetime";

type RecordPaymentModalProps = {
  open: boolean;
  invoiceId: string;
  balanceDue: number;
  onClose: () => void;
};

export function RecordPaymentModal({
  open,
  invoiceId,
  balanceDue,
  onClose,
}: RecordPaymentModalProps) {
  const router = useRouter();
  const [state, formAction] = useActionState<InvoiceActionState, FormData>(
    recordPaymentAction,
    {},
  );

  useEffect(() => {
    if (state.success) {
      onClose();
      router.refresh();
    }
  }, [onClose, router, state.success]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <form
        action={formAction}
        className="relative w-full max-w-md rounded-xl border border-white/[0.08] bg-zinc-900 p-5 shadow-2xl"
      >
        <input type="hidden" name="invoice_id" value={invoiceId} />
        <h2 className="text-base font-semibold text-white">Record payment</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Balance due: {formatCurrency(balanceDue)}
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm text-zinc-300">Amount</label>
            <input
              type="number"
              name="amount"
              min="0.01"
              max={balanceDue}
              step="0.01"
              defaultValue={balanceDue}
              required
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-950/50 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-300">Payment date</label>
            <input
              type="date"
              name="payment_date"
              defaultValue={getTodayIsoDate()}
              required
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-950/50 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-300">Note</label>
            <input
              type="text"
              name="note"
              placeholder="Check, cash, transfer…"
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-950/50 px-3 py-2 text-sm text-white"
            />
          </div>
        </div>

        {state.error && (
          <p className="mt-3 text-sm text-rose-400">{state.error}</p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950"
          >
            Record payment
          </button>
        </div>
      </form>
    </div>
  );
}
