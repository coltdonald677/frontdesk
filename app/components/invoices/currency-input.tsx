"use client";

import { useEffect, useState } from "react";
import {
  formatCurrencyInput,
  parseCurrencyInput,
} from "@/lib/invoices/currency";

type CurrencyInputProps = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  placeholder?: string;
};

const baseClassName =
  "w-full rounded-lg border border-white/[0.06] bg-zinc-950/50 py-2 pl-7 pr-3 text-sm text-white tabular-nums placeholder:text-zinc-600 focus:border-indigo-500/40 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 disabled:opacity-50";

export function CurrencyInput({
  value,
  onChange,
  disabled = false,
  id,
  name,
  className = "",
  placeholder = "0.00",
}: CurrencyInputProps) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(formatCurrencyInput(value));

  useEffect(() => {
    if (!focused) {
      setText(formatCurrencyInput(value));
    }
  }, [focused, value]);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
        $
      </span>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={focused ? text : formatCurrencyInput(value)}
        onFocus={() => {
          setFocused(true);
          setText(value > 0 ? formatCurrencyInput(value) : "");
        }}
        onBlur={() => {
          setFocused(false);
          const parsed = parseCurrencyInput(text);
          onChange(parsed);
          setText(formatCurrencyInput(parsed));
        }}
        onChange={(event) => {
          const next = event.target.value;
          if (/^[0-9]*\.?[0-9]{0,2}$/.test(next) || next === "") {
            setText(next);
            onChange(parseCurrencyInput(next));
          }
        }}
        className={`${baseClassName} ${className}`}
      />
    </div>
  );
}
