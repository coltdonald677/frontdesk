"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getInvoiceSendPreviewAction,
  sendInvoiceAction,
} from "@/app/dashboard/invoices/actions";
import type { InvoiceSendPreview } from "@/lib/invoices/delivery-types";
import { formatCurrency } from "@/lib/invoices/types";

type SendInvoiceModalProps = {
  open: boolean;
  invoiceId: string;
  onClose: () => void;
  onSent: () => void;
};

export function SendInvoiceModal({
  open,
  invoiceId,
  onClose,
  onSent,
}: SendInvoiceModalProps) {
  const [preview, setPreview] = useState<InvoiceSendPreview | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setError(null);

    void getInvoiceSendPreviewAction(invoiceId).then((result) => {
      if (cancelled) {
        return;
      }

      if (result.error || !result.preview) {
        setError(result.error ?? "Invoice not found.");
        setPreview(null);
        return;
      }

      setPreview(result.preview);
      setMessage(result.preview.default_message ?? "");
    });

    return () => {
      cancelled = true;
    };
  }, [open, invoiceId]);

  if (!open) {
    return null;
  }

  function handleSend() {
    setError(null);
    startTransition(async () => {
      const result = await sendInvoiceAction(invoiceId, message);
      if (result.error) {
        setError(result.error);
        return;
      }

      onSent();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-zinc-950 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Send invoice</h2>
            <p className="mt-1 text-sm text-zinc-400">
              We will email a secure link. Recipient and totals come from your records.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-300"
          >
            Close
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-sm text-rose-300">
            {error}
          </div>
        )}

        {preview && (
          <div className="mt-5 space-y-4 text-sm">
            <div className="rounded-xl border border-white/[0.06] bg-zinc-900/50 p-4">
              <dl className="space-y-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Invoice</dt>
                  <dd className="font-medium text-white">{preview.invoice_number}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Customer</dt>
                  <dd className="text-zinc-200">{preview.customer_name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Email</dt>
                  <dd className="text-zinc-200">{preview.recipient_email}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Amount</dt>
                  <dd className="font-medium text-white">
                    {formatCurrency(preview.total_amount)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Due date</dt>
                  <dd className="text-zinc-200">{preview.due_date ?? "—"}</dd>
                </div>
              </dl>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-zinc-400">Optional message</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={4}
                className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-zinc-100"
                placeholder="Add a note for your customer"
              />
            </label>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/[0.08] px-4 py-2 text-sm text-zinc-300"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending || !preview?.can_send}
            onClick={handleSend}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
          >
            {isPending ? "Sending..." : "Send invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}
