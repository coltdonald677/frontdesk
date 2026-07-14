-- Broader Workforce Scheduling Phase 1 (additive, idempotent, non-destructive)
-- Review and apply manually in Supabase SQL editor.
--
-- Preserves existing public.appointments and customer scheduling unchanged.
-- customer_appointment continues to live in appointments (customer required there).
-- schedule_entries holds workforce work types: employee_shift, internal_work,
-- meeting, training, maintenance, job_assignment, and time_off.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'schedule_entry_type'
      and n.nspname = 'public'
  ) then
    create type public.schedule_entry_type as enum (
      'employee_shift',
      'internal_work',
      'meeting',
      'training',
      'maintenance',
      'job_assignment',
      'time_off'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'schedule_entry_status'
      and n.nspname = 'public'
  ) then
    create type public.schedule_entry_status as enum (
      'scheduled',
      'completed',
      'cancelled'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'schedule_entry_source'
      and n.nspname = 'public'
  ) then
    create type public.schedule_entry_source as enum (
      'manual',
      'ask_pluto',
      'recurring_series'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'recurrence_pattern_type'
      and n.nspname = 'public'
  ) then
    create type public.recurrence_pattern_type as enum (
      'weekly',
      'alternating_weekly'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'schedule_series_status'
      and n.nspname = 'public'
  ) then
    create type public.schedule_series_status as enum (
      'active',
      'stopped'
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- schedule_series (recurring schedule foundation)
-- ---------------------------------------------------------------------------

create table if not exists public.schedule_series (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  entry_type public.schedule_entry_type not null,
  title text not null,
  description text,
  site_location text,
  customer_id uuid references public.customers (id) on delete set null,
  timezone text not null default 'America/Denver',
  pattern_type public.recurrence_pattern_type not null default 'weekly',
  pattern_config jsonb not null default '{}'::jsonb,
  series_start_date date not null,
  series_end_date date,
  default_start_time time,
  default_end_time time,
  all_day boolean not null default false,
  status public.schedule_series_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'schedule_series_end_after_start'
      and conrelid = 'public.schedule_series'::regclass
  ) then
    alter table public.schedule_series
      add constraint schedule_series_end_after_start check (
        series_end_date is null or series_end_date >= series_start_date
      );
  end if;
end
$$;

create index if not exists schedule_series_business_profile_id_idx
  on public.schedule_series (business_profile_id);

create index if not exists schedule_series_active_idx
  on public.schedule_series (business_profile_id, status)
  where status = 'active';

create index if not exists schedule_series_date_range_idx
  on public.schedule_series (business_profile_id, series_start_date, series_end_date);

-- ---------------------------------------------------------------------------
-- schedule_entries (workforce schedule entries)
-- ---------------------------------------------------------------------------

create table if not exists public.schedule_entries (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  series_id uuid references public.schedule_series (id) on delete set null,
  occurrence_index integer,
  entry_type public.schedule_entry_type not null,
  title text not null,
  description text,
  customer_id uuid references public.customers (id) on delete set null,
  site_location text,
  start_date date not null,
  end_date date not null,
  start_time time,
  end_time time,
  all_day boolean not null default false,
  timezone text not null default 'America/Denver',
  status public.schedule_entry_status not null default 'scheduled',
  source public.schedule_entry_source not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'schedule_entries_end_date_after_start'
      and conrelid = 'public.schedule_entries'::regclass
  ) then
    alter table public.schedule_entries
      add constraint schedule_entries_end_date_after_start check (end_date >= start_date);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'schedule_entries_time_off_no_customer'
      and conrelid = 'public.schedule_entries'::regclass
  ) then
    alter table public.schedule_entries
      add constraint schedule_entries_time_off_no_customer check (
        entry_type <> 'time_off' or customer_id is null
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'schedule_entries_timed_range'
      and conrelid = 'public.schedule_entries'::regclass
  ) then
    alter table public.schedule_entries
      add constraint schedule_entries_timed_range check (
        all_day = true
        or (
          start_time is not null
          and end_time is not null
          and end_time > start_time
        )
      );
  end if;
end
$$;

create index if not exists schedule_entries_business_profile_id_idx
  on public.schedule_entries (business_profile_id);

create index if not exists schedule_entries_date_range_idx
  on public.schedule_entries (business_profile_id, start_date, end_date);

create index if not exists schedule_entries_series_id_idx
  on public.schedule_entries (series_id)
  where series_id is not null;

create index if not exists schedule_entries_entry_type_idx
  on public.schedule_entries (business_profile_id, entry_type);

create index if not exists schedule_entries_status_idx
  on public.schedule_entries (business_profile_id, status)
  where status = 'scheduled';

create index if not exists schedule_entries_customer_id_idx
  on public.schedule_entries (customer_id)
  where customer_id is not null;

-- ---------------------------------------------------------------------------
-- schedule_entry_employees (one or many employees per entry)
-- ---------------------------------------------------------------------------

create table if not exists public.schedule_entry_employees (
  schedule_entry_id uuid not null references public.schedule_entries (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (schedule_entry_id, employee_id)
);

create index if not exists schedule_entry_employees_employee_id_idx
  on public.schedule_entry_employees (employee_id);

create index if not exists schedule_entry_employees_business_profile_id_idx
  on public.schedule_entry_employees (business_profile_id);

create index if not exists schedule_entry_employees_entry_business_idx
  on public.schedule_entry_employees (schedule_entry_id, business_profile_id);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.schedule_series enable row level security;
alter table public.schedule_entries enable row level security;
alter table public.schedule_entry_employees enable row level security;

-- schedule_series policies

drop policy if exists "Users can view their business schedule series"
  on public.schedule_series;

create policy "Users can view their business schedule series"
  on public.schedule_series
  for select
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = schedule_series.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert schedule series for their business"
  on public.schedule_series;

create policy "Users can insert schedule series for their business"
  on public.schedule_series
  for insert
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = schedule_series.business_profile_id
        and bp.user_id = auth.uid()
    )
    and (
      schedule_series.customer_id is null
      or exists (
        select 1
        from public.customers c
        where c.id = schedule_series.customer_id
          and c.business_profile_id = schedule_series.business_profile_id
      )
    )
  );

drop policy if exists "Users can update their business schedule series"
  on public.schedule_series;

create policy "Users can update their business schedule series"
  on public.schedule_series
  for update
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = schedule_series.business_profile_id
        and bp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = schedule_series.business_profile_id
        and bp.user_id = auth.uid()
    )
    and (
      schedule_series.customer_id is null
      or exists (
        select 1
        from public.customers c
        where c.id = schedule_series.customer_id
          and c.business_profile_id = schedule_series.business_profile_id
      )
    )
  );

drop policy if exists "Users can delete their business schedule series"
  on public.schedule_series;

create policy "Users can delete their business schedule series"
  on public.schedule_series
  for delete
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = schedule_series.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

-- schedule_entries policies

drop policy if exists "Users can view their business schedule entries"
  on public.schedule_entries;

create policy "Users can view their business schedule entries"
  on public.schedule_entries
  for select
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = schedule_entries.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert schedule entries for their business"
  on public.schedule_entries;

create policy "Users can insert schedule entries for their business"
  on public.schedule_entries
  for insert
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = schedule_entries.business_profile_id
        and bp.user_id = auth.uid()
    )
    and (
      schedule_entries.customer_id is null
      or exists (
        select 1
        from public.customers c
        where c.id = schedule_entries.customer_id
          and c.business_profile_id = schedule_entries.business_profile_id
      )
    )
    and (
      schedule_entries.series_id is null
      or exists (
        select 1
        from public.schedule_series ss
        where ss.id = schedule_entries.series_id
          and ss.business_profile_id = schedule_entries.business_profile_id
      )
    )
  );

drop policy if exists "Users can update their business schedule entries"
  on public.schedule_entries;

create policy "Users can update their business schedule entries"
  on public.schedule_entries
  for update
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = schedule_entries.business_profile_id
        and bp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = schedule_entries.business_profile_id
        and bp.user_id = auth.uid()
    )
    and (
      schedule_entries.customer_id is null
      or exists (
        select 1
        from public.customers c
        where c.id = schedule_entries.customer_id
          and c.business_profile_id = schedule_entries.business_profile_id
      )
    )
    and (
      schedule_entries.series_id is null
      or exists (
        select 1
        from public.schedule_series ss
        where ss.id = schedule_entries.series_id
          and ss.business_profile_id = schedule_entries.business_profile_id
      )
    )
  );

drop policy if exists "Users can delete their business schedule entries"
  on public.schedule_entries;

create policy "Users can delete their business schedule entries"
  on public.schedule_entries
  for delete
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = schedule_entries.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

-- schedule_entry_employees policies

drop policy if exists "Users can view their business schedule entry employees"
  on public.schedule_entry_employees;

create policy "Users can view their business schedule entry employees"
  on public.schedule_entry_employees
  for select
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = schedule_entry_employees.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert schedule entry employees for their business"
  on public.schedule_entry_employees;

create policy "Users can insert schedule entry employees for their business"
  on public.schedule_entry_employees
  for insert
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = schedule_entry_employees.business_profile_id
        and bp.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.schedule_entries se
      where se.id = schedule_entry_employees.schedule_entry_id
        and se.business_profile_id = schedule_entry_employees.business_profile_id
    )
    and exists (
      select 1
      from public.employees e
      where e.id = schedule_entry_employees.employee_id
        and e.business_profile_id = schedule_entry_employees.business_profile_id
    )
  );

drop policy if exists "Users can update their business schedule entry employees"
  on public.schedule_entry_employees;

create policy "Users can update their business schedule entry employees"
  on public.schedule_entry_employees
  for update
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = schedule_entry_employees.business_profile_id
        and bp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = schedule_entry_employees.business_profile_id
        and bp.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.schedule_entries se
      where se.id = schedule_entry_employees.schedule_entry_id
        and se.business_profile_id = schedule_entry_employees.business_profile_id
    )
    and exists (
      select 1
      from public.employees e
      where e.id = schedule_entry_employees.employee_id
        and e.business_profile_id = schedule_entry_employees.business_profile_id
    )
  );

drop policy if exists "Users can delete their business schedule entry employees"
  on public.schedule_entry_employees;

create policy "Users can delete their business schedule entry employees"
  on public.schedule_entry_employees
  for delete
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = schedule_entry_employees.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- updated_at helpers
-- ---------------------------------------------------------------------------

create or replace function public.handle_schedule_series_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_schedule_entries_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists schedule_series_updated_at on public.schedule_series;

create trigger schedule_series_updated_at
  before update on public.schedule_series
  for each row
  execute function public.handle_schedule_series_updated_at();

drop trigger if exists schedule_entries_updated_at on public.schedule_entries;

create trigger schedule_entries_updated_at
  before update on public.schedule_entries
  for each row
  execute function public.handle_schedule_entries_updated_at();
