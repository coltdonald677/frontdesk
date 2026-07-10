-- Employees linked to the authenticated user's business profile
create type public.employee_status as enum ('active', 'inactive');

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  position text,
  status public.employee_status not null default 'active',
  color text not null default 'indigo',
  hire_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employees_business_profile_id_idx
  on public.employees (business_profile_id);

create index if not exists employees_active_idx
  on public.employees (business_profile_id)
  where status = 'active';

alter table public.employees enable row level security;

create policy "Users can view their business employees"
  on public.employees
  for select
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = employees.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

create policy "Users can insert employees for their business"
  on public.employees
  for insert
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = employees.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

create policy "Users can update their business employees"
  on public.employees
  for update
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = employees.business_profile_id
        and bp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = employees.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

create policy "Users can delete their business employees"
  on public.employees
  for delete
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = employees.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

create or replace function public.handle_employees_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger employees_updated_at
  before update on public.employees
  for each row
  execute function public.handle_employees_updated_at();
