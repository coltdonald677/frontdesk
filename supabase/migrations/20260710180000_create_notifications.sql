-- In-app notification center for Pluto
create type public.notification_severity as enum (
  'critical',
  'warning',
  'info',
  'success'
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  type text not null,
  severity public.notification_severity not null default 'info',
  title text not null,
  description text,
  action_label text,
  action_href text,
  related_entity_type text,
  related_entity_id uuid,
  source text not null default 'system',
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists notifications_business_profile_id_idx
  on public.notifications (business_profile_id);

create index if not exists notifications_unread_idx
  on public.notifications (business_profile_id, created_at desc)
  where is_read = false;

create index if not exists notifications_created_at_idx
  on public.notifications (business_profile_id, created_at desc);

alter table public.notifications enable row level security;

create policy "Users can view their business notifications"
  on public.notifications
  for select
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = notifications.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

create policy "Users can insert notifications for their business"
  on public.notifications
  for insert
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = notifications.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

create policy "Users can update their business notifications"
  on public.notifications
  for update
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = notifications.business_profile_id
        and bp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = notifications.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

create policy "Users can delete their business notifications"
  on public.notifications
  for delete
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = notifications.business_profile_id
        and bp.user_id = auth.uid()
    )
  );
