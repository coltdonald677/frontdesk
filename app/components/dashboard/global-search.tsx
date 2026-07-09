"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { globalSearchAction } from "@/app/dashboard/search/actions";
import {
  EMPTY_GLOBAL_SEARCH_RESULTS,
  flattenGlobalSearchResults,
  hasGlobalSearchResults,
  type GlobalSearchResult,
  type GlobalSearchResults,
} from "@/lib/search/types";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

const SECTIONS = [
  { key: "customers" as const, label: "Customers" },
  { key: "tasks" as const, label: "Tasks" },
  { key: "appointments" as const, label: "Appointments" },
];

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
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
  );
}

function ResultIcon({ type }: { type: GlobalSearchResult["type"] }) {
  if (type === "customer") {
    return (
      <svg
        className="h-4 w-4 text-indigo-300"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
        />
      </svg>
    );
  }

  if (type === "task") {
    return (
      <svg
        className="h-4 w-4 text-emerald-300"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    );
  }

  return (
    <svg
      className="h-4 w-4 text-violet-300"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
      />
    </svg>
  );
}

function SearchDropdown({
  results,
  query,
  loading,
  error,
  activeIndex,
  listboxId,
  onSelect,
  onHover,
}: {
  results: GlobalSearchResults;
  query: string;
  loading: boolean;
  error: string | null;
  activeIndex: number;
  listboxId: string;
  onSelect: (result: GlobalSearchResult) => void;
  onHover: (index: number) => void;
}) {
  const flatResults = useMemo(() => flattenGlobalSearchResults(results), [results]);
  let runningIndex = -1;

  if (query.trim().length < MIN_QUERY_LENGTH) {
    return null;
  }

  return (
    <div
      id={listboxId}
      role="listbox"
      className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-900 shadow-2xl shadow-black/40"
    >
      {loading && (
        <div className="px-4 py-3 text-sm text-zinc-500">Searching...</div>
      )}

      {!loading && error && (
        <div className="px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {!loading && !error && !hasGlobalSearchResults(results) && (
        <div className="px-4 py-6 text-center">
          <p className="text-sm font-medium text-zinc-300">No results found</p>
          <p className="mt-1 text-xs text-zinc-500">
            Try a customer name, company, email, phone, task, or appointment.
          </p>
        </div>
      )}

      {!loading && !error && hasGlobalSearchResults(results) && (
        <div className="max-h-[min(24rem,calc(100vh-8rem))] overflow-y-auto py-2">
          {SECTIONS.map((section) => {
            const sectionResults = results[section.key];

            if (sectionResults.length === 0) {
              return null;
            }

            return (
              <div key={section.key} className="px-2 py-1">
                <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  {section.label}
                </p>
                <ul>
                  {sectionResults.map((result) => {
                    runningIndex += 1;
                    const itemIndex = runningIndex;
                    const isActive = itemIndex === activeIndex;

                    return (
                      <li key={`${result.type}-${result.id}`}>
                        <button
                          id={`${listboxId}-option-${itemIndex}`}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          onMouseEnter={() => onHover(itemIndex)}
                          onClick={() => onSelect(result)}
                          className={`flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left transition-colors ${
                            isActive
                              ? "bg-indigo-500/15 text-white"
                              : "text-zinc-200 hover:bg-white/[0.04]"
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                              isActive
                                ? "border-indigo-500/30 bg-indigo-500/10"
                                : "border-white/[0.06] bg-zinc-800/60"
                            }`}
                          >
                            <ResultIcon type={result.type} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {result.name}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-zinc-500">
                              {result.subtitle}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {!loading && flatResults.length > 0 && (
        <div className="border-t border-white/[0.06] px-4 py-2 text-[11px] text-zinc-500">
          <span className="hidden sm:inline">
            ↑↓ navigate · Enter open · Esc close
          </span>
          <span className="sm:hidden">Tap a result to open</span>
        </div>
      )}
    </div>
  );
}

type SearchFieldProps = {
  query: string;
  loading: boolean;
  open: boolean;
  activeIndex: number;
  results: GlobalSearchResults;
  error: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  listboxId: string;
  onQueryChange: (value: string) => void;
  onFocus: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onSelect: (result: GlobalSearchResult) => void;
  onHover: (index: number) => void;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
};

function SearchField({
  query,
  loading,
  open,
  activeIndex,
  results,
  error,
  inputRef,
  listboxId,
  onQueryChange,
  onFocus,
  onKeyDown,
  onSelect,
  onHover,
  className = "",
  inputClassName = "",
  autoFocus = false,
}: SearchFieldProps) {
  return (
    <div className={`relative ${className}`}>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={
          activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
        }
        aria-autocomplete="list"
        placeholder="Search customers, tasks, appointments..."
        onChange={(event) => onQueryChange(event.target.value)}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        className={`h-9 w-full rounded-lg border border-white/[0.06] bg-zinc-900/50 pl-9 pr-4 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 ${inputClassName}`}
      />
      {open && (
        <SearchDropdown
          results={results}
          query={query}
          loading={loading}
          error={error}
          activeIndex={activeIndex}
          listboxId={listboxId}
          onSelect={onSelect}
          onHover={onHover}
        />
      )}
    </div>
  );
}

export function GlobalSearch() {
  const router = useRouter();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResults>(
    EMPTY_GLOBAL_SEARCH_RESULTS,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const flatResults = useMemo(() => flattenGlobalSearchResults(results), [results]);

  const closeSearch = useCallback(() => {
    setOpen(false);
    setMobileOpen(false);
    setActiveIndex(-1);
  }, []);

  const openResult = useCallback(
    (result: GlobalSearchResult) => {
      closeSearch();
      setQuery("");
      setResults(EMPTY_GLOBAL_SEARCH_RESULTS);
      router.push(result.href);
    },
    [closeSearch, router],
  );

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults(EMPTY_GLOBAL_SEARCH_RESULTS);
      setLoading(false);
      setError(null);
      setActiveIndex(-1);
      return;
    }

    setLoading(true);
    setError(null);

    const requestId = ++requestIdRef.current;

    const timer = window.setTimeout(async () => {
      const response = await globalSearchAction(trimmed);

      if (requestId !== requestIdRef.current) {
        return;
      }

      setResults(response.results);
      setError(response.error ?? null);
      setLoading(false);
      setActiveIndex(
        hasGlobalSearchResults(response.results)
          ? 0
          : -1,
      );
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open && !mobileOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeSearch();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [closeSearch, mobileOpen, open]);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSearch();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [closeSearch, mobileOpen]);

  useEffect(() => {
    if (activeIndex < 0) {
      return;
    }

    document
      .getElementById(`${listboxId}-option-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listboxId]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSearch();
      event.currentTarget.blur();
      return;
    }

    if (flatResults.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        current >= flatResults.length - 1 ? 0 : current + 1,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current <= 0 ? flatResults.length - 1 : current - 1,
      );
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const selected = flatResults[activeIndex];
      if (selected) {
        openResult(selected);
      }
    }
  };

  const dropdownOpen =
    (open || mobileOpen) && query.trim().length >= MIN_QUERY_LENGTH;

  const sharedFieldProps = {
    query,
    loading,
    open: dropdownOpen,
    activeIndex,
    results,
    error,
    listboxId,
    onQueryChange: setQuery,
    onSelect: openResult,
    onHover: setActiveIndex,
    onKeyDown: handleKeyDown,
  };

  return (
    <div ref={rootRef} className="relative flex items-center">
      <button
        type="button"
        onClick={() => {
          setMobileOpen(true);
          setOpen(true);
          window.setTimeout(() => mobileInputRef.current?.focus(), 0);
        }}
        className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white sm:hidden"
        aria-label="Open search"
      >
        <SearchIcon className="h-5 w-5" />
      </button>

      <SearchField
        {...sharedFieldProps}
        inputRef={inputRef}
        onFocus={() => setOpen(true)}
        className="hidden sm:block lg:w-80 sm:w-64"
      />

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-zinc-950/90 p-4 backdrop-blur-sm sm:hidden">
          <div className="mx-auto flex max-w-lg items-center gap-2">
            <SearchField
              {...sharedFieldProps}
              inputRef={mobileInputRef}
              autoFocus
              onFocus={() => {
                setOpen(true);
                setMobileOpen(true);
              }}
              className="flex-1"
              inputClassName="h-11"
            />
            <button
              type="button"
              onClick={closeSearch}
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg px-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
