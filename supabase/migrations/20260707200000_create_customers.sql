-- Customers linked to the authenticated user's business profile
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  name text not null,
  company text,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_business_profile_id_idx
  on public.customers (business_profile_id);

alter table public.customers enable row level security;

create policy "Users can view their business customers"
  on public.customers
  for select
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = customers.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

create policy "Users can insert customers for their business"
  on public.customers
  for insert
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = customers.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

create policy "Users can update their business customers"
  on public.customers
  for update
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = customers.business_profile_id
        and bp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = customers.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

create policy "Users can delete their business customers"
  on public.customers
  for delete
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = customers.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

create or replace function public.handle_customers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger customers_updated_at
  before update on public.customers
  for each row
  execute function public.handle_customers_updated_at();
