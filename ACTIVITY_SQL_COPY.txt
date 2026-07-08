-- Customer activity history linked to customers and business profiles
create type public.customer_activity_type as enum (
  'note',
  'call',
  'email',
  'meeting',
  'follow_up'
);

create table if not exists public.customer_activities (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  activity_type public.customer_activity_type not null default 'note',
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists customer_activities_customer_id_idx
  on public.customer_activities (customer_id);

create index if not exists customer_activities_business_profile_id_idx
  on public.customer_activities (business_profile_id);

create index if not exists customer_activities_created_at_idx
  on public.customer_activities (customer_id, created_at desc);

alter table public.customer_activities enable row level security;

create policy "Users can view their business customer activities"
  on public.customer_activities
  for select
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = customer_activities.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

create policy "Users can insert customer activities for their business"
  on public.customer_activities
  for insert
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = customer_activities.business_profile_id
        and bp.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.customers c
      where c.id = customer_activities.customer_id
        and c.business_profile_id = customer_activities.business_profile_id
    )
  );

create policy "Users can update their business customer activities"
  on public.customer_activities
  for update
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = customer_activities.business_profile_id
        and bp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = customer_activities.business_profile_id
        and bp.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.customers c
      where c.id = customer_activities.customer_id
        and c.business_profile_id = customer_activities.business_profile_id
    )
  );

create policy "Users can delete their business customer activities"
  on public.customer_activities
  for delete
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = customer_activities.business_profile_id
        and bp.user_id = auth.uid()
    )
  );
