-- Business profiles linked to authenticated users
create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_name text not null,
  industry text not null,
  phone_number text not null,
  business_address text not null,
  main_goal text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_profiles_user_id_key unique (user_id)
);

alter table public.business_profiles enable row level security;

create policy "Users can view their own business profile"
  on public.business_profiles
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own business profile"
  on public.business_profiles
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own business profile"
  on public.business_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.handle_business_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger business_profiles_updated_at
  before update on public.business_profiles
  for each row
  execute function public.handle_business_profiles_updated_at();
