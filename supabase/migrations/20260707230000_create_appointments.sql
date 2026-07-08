-- Appointments linked to business profiles and customers
create type public.appointment_status as enum (
  'scheduled',
  'completed',
  'cancelled'
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  title text not null,
  notes text,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  status public.appointment_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_end_after_start check (end_time > start_time)
);

create index if not exists appointments_business_profile_id_idx
  on public.appointments (business_profile_id);

create index if not exists appointments_customer_id_idx
  on public.appointments (customer_id);

create index if not exists appointments_date_idx
  on public.appointments (business_profile_id, appointment_date);

create index if not exists appointments_upcoming_idx
  on public.appointments (customer_id, appointment_date, start_time)
  where status = 'scheduled';

alter table public.appointments enable row level security;

create policy "Users can view their business appointments"
  on public.appointments
  for select
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = appointments.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

create policy "Users can insert appointments for their business"
  on public.appointments
  for insert
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = appointments.business_profile_id
        and bp.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.customers c
      where c.id = appointments.customer_id
        and c.business_profile_id = appointments.business_profile_id
    )
  );

create policy "Users can update their business appointments"
  on public.appointments
  for update
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = appointments.business_profile_id
        and bp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = appointments.business_profile_id
        and bp.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.customers c
      where c.id = appointments.customer_id
        and c.business_profile_id = appointments.business_profile_id
    )
  );

create policy "Users can delete their business appointments"
  on public.appointments
  for delete
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = appointments.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

create or replace function public.handle_appointments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger appointments_updated_at
  before update on public.appointments
  for each row
  execute function public.handle_appointments_updated_at();
