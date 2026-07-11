"use client";

import { useEffect, useState } from "react";

const inputClassName =
  "w-full rounded-lg border border-white/[0.06] bg-zinc-950/50 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500/40 focus:outline-none focus:ring-1 focus:ring-indigo-500/30";

const labelClassName =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500";

export function SettingsField({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className={labelClassName}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

export function SettingsTextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClassName} ${props.className ?? ""}`} />;
}

export function SettingsTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${inputClassName} min-h-[96px] resize-y ${props.className ?? ""}`}
    />
  );
}

export function SettingsSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClassName} ${props.className ?? ""}`} />;
}

export function SettingsToggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg border border-white/[0.06] bg-zinc-950/30 px-4 py-3">
      <span>
        <span className="block text-sm font-medium text-white">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-zinc-500">{description}</span>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-white/20 bg-zinc-900 text-indigo-500"
      />
    </label>
  );
}

export function SettingsFormShell({
  title,
  description,
  children,
  onSave,
  saving,
  state,
  dirty,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onSave: () => void;
  saving: boolean;
  state: { error?: string; success?: boolean; message?: string };
  dirty: boolean;
}) {
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/50 p-5 sm:p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-zinc-400">{description}</p>
      </div>

      <div className="space-y-5">{children}</div>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-4">
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !dirty}
          className="rounded-lg bg-indigo-500/20 px-4 py-2 text-sm font-medium text-indigo-200 transition-colors hover:bg-indigo-500/30 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {dirty && !saving && (
          <span className="text-xs text-amber-300/90">Unsaved changes</span>
        )}
        {state.success && state.message && (
          <span className="text-sm text-emerald-400">{state.message}</span>
        )}
        {state.error && <span className="text-sm text-rose-400">{state.error}</span>}
      </div>
    </div>
  );
}

export function useSettingsSection<T>(initial: T) {
  const [value, setValue] = useState(initial);
  const [dirty, setDirty] = useState(false);

  function update(updater: (current: T) => T) {
    setValue((current) => updater(current));
    setDirty(true);
  }

  function reset(next: T) {
    setValue(next);
    setDirty(false);
  }

  return { value, setValue: update, dirty, reset, markSaved: () => setDirty(false) };
}

export function SettingsCheckboxGroup({
  options,
  values,
  onChange,
}: {
  options: Array<{ id: string; label: string }>;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = values.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            onClick={() =>
              onChange(
                active ? values.filter((item) => item !== option.id) : [...values, option.id],
              )
            }
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/30"
                : "border border-white/[0.06] text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
