"use client";

import type { InvoiceLineItemInput } from "@/lib/invoices";
import {
  calculateLineTotal,
} from "@/lib/invoices/calculations";
import { formatCurrency } from "@/lib/invoices/types";
import { CurrencyInput } from "@/app/components/invoices/currency-input";
import {
  formatQuantityInput,
  parseQuantityInput,
} from "@/lib/invoices/currency";

export type EditableLineItem = InvoiceLineItemInput & { key: string };

type InvoiceLineItemsEditorProps = {
  lineItems: EditableLineItem[];
  readOnly?: boolean;
  onChange: (items: EditableLineItem[]) => void;
};

const inputClassName =
  "w-full rounded-lg border border-white/[0.06] bg-zinc-950/50 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500/40 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 disabled:opacity-50";

function updateItem(
  items: EditableLineItem[],
  key: string,
  patch: Partial<EditableLineItem>,
): EditableLineItem[] {
  return items.map((item) => (item.key === key ? { ...item, ...patch } : item));
}

export function createEmptyLineItem(): EditableLineItem {
  return {
    key: crypto.randomUUID(),
    description: "",
    quantity: 1,
    unit_price: 0,
    tax_rate: 0,
  };
}

export function InvoiceLineItemsEditor({
  lineItems,
  readOnly = false,
  onChange,
}: InvoiceLineItemsEditorProps) {
  function patchLineItem(key: string, patch: Partial<EditableLineItem>) {
    onChange(updateItem(lineItems, key, patch));
  }

  function addLineItem() {
    onChange([...lineItems, createEmptyLineItem()]);
  }

  function removeLineItem(key: string) {
    if (lineItems.length === 1) return;
    onChange(lineItems.filter((item) => item.key !== key));
  }

  function moveLineItem(key: string, direction: -1 | 1) {
    const index = lineItems.findIndex((item) => item.key === key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= lineItems.length) return;
    const next = [...lineItems];
    const [removed] = next.splice(index, 1);
    next.splice(target, 0, removed);
    onChange(next);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/40">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3 sm:px-5">
        <div>
          <h3 className="text-sm font-semibold text-white">Line items</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            Add products or services. Totals update as you type.
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={addLineItem}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-200 transition-colors hover:border-indigo-500/50 hover:bg-indigo-500/15"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add line
          </button>
        )}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-white/[0.06] bg-zinc-950/30 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3 sm:px-5">Description</th>
              <th className="w-24 px-3 py-3 text-right">Quantity</th>
              <th className="w-36 px-3 py-3 text-right">Unit price</th>
              <th className="w-24 px-3 py-3 text-right">Tax %</th>
              <th className="w-32 px-3 py-3 text-right">Line total</th>
              {!readOnly && <th className="w-24 px-3 py-3" aria-label="Actions" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {lineItems.map((item, index) => {
              const lineTotal = calculateLineTotal(
                item.quantity,
                item.unit_price,
                item.tax_rate,
              );

              return (
                <tr key={item.key} className="group align-top">
                  <td className="px-4 py-3 sm:px-5">
                    <input
                      value={item.description}
                      onChange={(event) =>
                        patchLineItem(item.key, { description: event.target.value })
                      }
                      disabled={readOnly}
                      placeholder="Service or product description"
                      className={inputClassName}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formatQuantityInput(item.quantity)}
                      onChange={(event) => {
                        const quantity = parseQuantityInput(event.target.value);
                        patchLineItem(item.key, {
                          quantity: quantity > 0 ? quantity : 0,
                        });
                      }}
                      onBlur={() => {
                        if (item.quantity <= 0) {
                          patchLineItem(item.key, { quantity: 1 });
                        }
                      }}
                      disabled={readOnly}
                      className={`${inputClassName} text-right tabular-nums`}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <CurrencyInput
                      value={item.unit_price}
                      onChange={(unit_price) =>
                        patchLineItem(item.key, { unit_price })
                      }
                      disabled={readOnly}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.tax_rate}
                        onChange={(event) => {
                          const raw = event.target.value.replace(/[^0-9.]/g, "");
                          if (/^[0-9]*\.?[0-9]{0,2}$/.test(raw) || raw === "") {
                            patchLineItem(item.key, {
                              tax_rate: Math.max(0, parseQuantityInput(raw)),
                            });
                          }
                        }}
                        disabled={readOnly}
                        className={`${inputClassName} pr-7 text-right tabular-nums`}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                        %
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex h-[38px] items-center justify-end rounded-lg border border-transparent bg-zinc-950/20 px-3 text-sm font-medium tabular-nums text-zinc-200">
                      {formatCurrency(lineTotal)}
                    </div>
                  </td>
                  {!readOnly && (
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => moveLineItem(item.key, -1)}
                          disabled={index === 0}
                          title="Move up"
                          className="rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300 disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveLineItem(item.key, 1)}
                          disabled={index === lineItems.length - 1}
                          title="Move down"
                          className="rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300 disabled:opacity-30"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => removeLineItem(item.key)}
                          disabled={lineItems.length === 1}
                          title="Remove line"
                          className="rounded p-1 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-30"
                        >
                          ×
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="space-y-3 p-4 md:hidden">
        {lineItems.map((item, index) => {
          const lineTotal = calculateLineTotal(
            item.quantity,
            item.unit_price,
            item.tax_rate,
          );

          return (
            <div
              key={item.key}
              className="rounded-lg border border-white/[0.06] bg-zinc-950/30 p-3"
            >
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Description
              </label>
              <input
                value={item.description}
                onChange={(event) =>
                  patchLineItem(item.key, { description: event.target.value })
                }
                disabled={readOnly}
                placeholder="Service or product description"
                className={`${inputClassName} mb-3`}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Quantity
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formatQuantityInput(item.quantity)}
                    onChange={(event) => {
                      const quantity = parseQuantityInput(event.target.value);
                      patchLineItem(item.key, {
                        quantity: quantity > 0 ? quantity : 0,
                      });
                    }}
                    onBlur={() => {
                      if (item.quantity <= 0) {
                        patchLineItem(item.key, { quantity: 1 });
                      }
                    }}
                    disabled={readOnly}
                    className={`${inputClassName} text-right`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Unit price
                  </label>
                  <CurrencyInput
                    value={item.unit_price}
                    onChange={(unit_price) =>
                      patchLineItem(item.key, { unit_price })
                    }
                    disabled={readOnly}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Tax %
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={item.tax_rate}
                    onChange={(event) => {
                      const raw = event.target.value.replace(/[^0-9.]/g, "");
                      if (/^[0-9]*\.?[0-9]{0,2}$/.test(raw) || raw === "") {
                        patchLineItem(item.key, {
                          tax_rate: Math.max(0, parseQuantityInput(raw)),
                        });
                      }
                    }}
                    disabled={readOnly}
                    className={`${inputClassName} text-right`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Line total
                  </label>
                  <div className="flex h-[38px] items-center justify-end rounded-lg bg-zinc-950/20 px-3 text-sm font-medium text-zinc-200">
                    {formatCurrency(lineTotal)}
                  </div>
                </div>
              </div>
              {!readOnly && (
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" onClick={() => moveLineItem(item.key, -1)} disabled={index === 0} className="text-xs text-zinc-500">Move up</button>
                  <button type="button" onClick={() => moveLineItem(item.key, 1)} disabled={index === lineItems.length - 1} className="text-xs text-zinc-500">Move down</button>
                  <button type="button" onClick={() => removeLineItem(item.key)} disabled={lineItems.length === 1} className="text-xs text-rose-400">Remove</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
