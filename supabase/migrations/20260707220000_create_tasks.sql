-- Tasks and reminders linked to business profiles, optionally to customers
create type public.task_priority as enum (
  'low',
  'medium',
  'high'
);

create type public.task_status as enum (
  'open',
  'completed'
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  title text not null,
  description text,
  due_date date,
  priority public.task_priority not null default 'medium',
  status public.task_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_business_profile_id_idx
  on public.tasks (business_profile_id);

create index if not exists tasks_customer_id_idx
  on public.tasks (customer_id);

create index if not exists tasks_open_due_date_idx
  on public.tasks (business_profile_id, due_date)
  where status = 'open';

alter table public.tasks enable row level security;

create policy "Users can view their business tasks"
  on public.tasks
  for select
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = tasks.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

create policy "Users can insert tasks for their business"
  on public.tasks
  for insert
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = tasks.business_profile_id
        and bp.user_id = auth.uid()
    )
    and (
      tasks.customer_id is null
      or exists (
        select 1
        from public.customers c
        where c.id = tasks.customer_id
          and c.business_profile_id = tasks.business_profile_id
      )
    )
  );

create policy "Users can update their business tasks"
  on public.tasks
  for update
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = tasks.business_profile_id
        and bp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = tasks.business_profile_id
        and bp.user_id = auth.uid()
    )
    and (
      tasks.customer_id is null
      or exists (
        select 1
        from public.customers c
        where c.id = tasks.customer_id
          and c.business_profile_id = tasks.business_profile_id
      )
    )
  );

create policy "Users can delete their business tasks"
  on public.tasks
  for delete
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = tasks.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

create or replace function public.handle_tasks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_updated_at
  before update on public.tasks
  for each row
  execute function public.handle_tasks_updated_at();
