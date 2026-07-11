-- Business profile extensions, operating settings, business rules, and logo storage.
-- Additive / idempotent: no DROP, DELETE, or TRUNCATE. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Extend business_profiles
-- ---------------------------------------------------------------------------
alter table public.business_profiles
  add column if not exists legal_business_name text,
  add column if not exists logo_storage_path text,
  add column if not exists business_description text,
  add column if not exists city text not null default '',
  add column if not exists state_province text not null default '',
  add column if not exists postal_code text not null default '',
  add column if not exists country text not null default 'US',
  add column if not exists email text not null default '',
  add column if not exists website text not null default '',
  add column if not exists timezone text not null default 'America/Denver',
  add column if not exists currency text not null default 'USD',
  add column if not exists date_format text not null default 'medium',
  add column if not exists time_format text not null default '12h',
  add column if not exists week_start_day text not null default 'monday',
  add column if not exists tax_registration_number text not null default '',
  add column if not exists default_tax_rate numeric not null default 0,
  add column if not exists business_hours jsonb not null default '{}'::jsonb,
  add column if not exists scheduling_settings jsonb not null default '{}'::jsonb,
  add column if not exists employee_settings jsonb not null default '{}'::jsonb,
  add column if not exists invoice_settings jsonb not null default '{}'::jsonb,
  add column if not exists notification_settings jsonb not null default '{}'::jsonb,
  add column if not exists ai_settings jsonb not null default '{}'::jsonb,
  add column if not exists automation_preferences jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Business operating rules (plain-text instructions for Pluto Brain)
-- ---------------------------------------------------------------------------
create table if not exists public.business_rules (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  title text not null,
  instruction text not null,
  category text not null check (
    category in (
      'scheduling',
      'employees',
      'customers',
      'invoices',
      'communications',
      'automations',
      'general'
    )
  ),
  priority text not null default 'normal' check (
    priority in ('low', 'normal', 'high', 'critical')
  ),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_rules_business_profile_id_idx
  on public.business_rules (business_profile_id);

create index if not exists business_rules_enabled_idx
  on public.business_rules (business_profile_id, enabled);

alter table public.business_rules enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'business_rules'
      and policyname = 'Users can view their business rules'
  ) then
    create policy "Users can view their business rules"
      on public.business_rules
      for select
      using (
        exists (
          select 1
          from public.business_profiles bp
          where bp.id = business_rules.business_profile_id
            and bp.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'business_rules'
      and policyname = 'Users can insert their business rules'
  ) then
    create policy "Users can insert their business rules"
      on public.business_rules
      for insert
      with check (
        exists (
          select 1
          from public.business_profiles bp
          where bp.id = business_rules.business_profile_id
            and bp.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'business_rules'
      and policyname = 'Users can update their business rules'
  ) then
    create policy "Users can update their business rules"
      on public.business_rules
      for update
      using (
        exists (
          select 1
          from public.business_profiles bp
          where bp.id = business_rules.business_profile_id
            and bp.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.business_profiles bp
          where bp.id = business_rules.business_profile_id
            and bp.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'business_rules'
      and policyname = 'Users can delete their business rules'
  ) then
    create policy "Users can delete their business rules"
      on public.business_rules
      for delete
      using (
        exists (
          select 1
          from public.business_profiles bp
          where bp.id = business_rules.business_profile_id
            and bp.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'business_rules_updated_at'
      and tgrelid = 'public.business_rules'::regclass
  ) then
    create trigger business_rules_updated_at
      before update on public.business_rules
      for each row
      execute function public.handle_business_profiles_updated_at();
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Logo / business asset storage (same pattern as communication attachments)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('business-assets', 'business-assets', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can upload business assets'
  ) then
    create policy "Users can upload business assets"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'business-assets'
        and (storage.foldername(name))[1] in (
          select bp.id::text
          from public.business_profiles bp
          where bp.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can view their business assets'
  ) then
    create policy "Users can view their business assets"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'business-assets'
        and (storage.foldername(name))[1] in (
          select bp.id::text
          from public.business_profiles bp
          where bp.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can update their business assets'
  ) then
    create policy "Users can update their business assets"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'business-assets'
        and (storage.foldername(name))[1] in (
          select bp.id::text
          from public.business_profiles bp
          where bp.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can delete their business assets'
  ) then
    create policy "Users can delete their business assets"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'business-assets'
        and (storage.foldername(name))[1] in (
          select bp.id::text
          from public.business_profiles bp
          where bp.user_id = auth.uid()
        )
      );
  end if;
end
$$;
