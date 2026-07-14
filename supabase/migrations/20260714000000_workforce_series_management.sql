-- Workforce Schedule Series Management (additive, idempotent)
-- Review and apply manually in Supabase SQL editor.
-- Extends Phase 1 series architecture for exceptions, splits, and stop-series.

-- ---------------------------------------------------------------------------
-- schedule_series: split lineage + explicit stop date
-- ---------------------------------------------------------------------------

alter table public.schedule_series
  add column if not exists predecessor_series_id uuid references public.schedule_series (id) on delete set null;

alter table public.schedule_series
  add column if not exists successor_series_id uuid references public.schedule_series (id) on delete set null;

alter table public.schedule_series
  add column if not exists stopped_at_date date;

create index if not exists schedule_series_predecessor_idx
  on public.schedule_series (predecessor_series_id)
  where predecessor_series_id is not null;

create index if not exists schedule_series_successor_idx
  on public.schedule_series (successor_series_id)
  where successor_series_id is not null;

-- ---------------------------------------------------------------------------
-- schedule_entries: exception tracking for edited occurrences
-- ---------------------------------------------------------------------------

alter table public.schedule_entries
  add column if not exists is_exception boolean not null default false;

create index if not exists schedule_entries_series_exception_idx
  on public.schedule_entries (series_id, is_exception)
  where series_id is not null;
