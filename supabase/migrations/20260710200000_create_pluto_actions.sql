-- Pluto Action Center: proposed and executed business actions (idempotent)

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'pluto_action_risk_level'
      and n.nspname = 'public'
  ) then
    create type public.pluto_action_risk_level as enum (
      'low',
      'medium',
      'high'
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
    where t.typname = 'pluto_action_status'
      and n.nspname = 'public'
  ) then
    create type public.pluto_action_status as enum (
      'proposed',
      'approved',
      'executing',
      'completed',
      'failed',
      'rejected'
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
    where t.typname = 'pluto_action_source'
      and n.nspname = 'public'
  ) then
    create type public.pluto_action_source as enum (
      'recommendation',
      'automation',
      'user',
      'ai'
    );
  end if;
end
$$;

create table if not exists public.pluto_actions (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  action_type text not null,
  title text not null,
  explanation text not null,
  risk_level public.pluto_action_risk_level not null default 'medium',
  status public.pluto_action_status not null default 'proposed',
  payload jsonb not null default '{}'::jsonb,
  related_entity_type text,
  related_entity_id uuid,
  source public.pluto_action_source not null default 'recommendation',
  recommendation_id text,
  result_message text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists pluto_actions_business_profile_id_idx
  on public.pluto_actions (business_profile_id);

create index if not exists pluto_actions_status_idx
  on public.pluto_actions (business_profile_id, status, created_at desc);

create index if not exists pluto_actions_recommendation_idx
  on public.pluto_actions (business_profile_id, recommendation_id)
  where recommendation_id is not null;

alter table public.pluto_actions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pluto_actions'
      and policyname = 'Users can view their business pluto actions'
  ) then
    create policy "Users can view their business pluto actions"
      on public.pluto_actions
      for select
      using (
        exists (
          select 1
          from public.business_profiles bp
          where bp.id = pluto_actions.business_profile_id
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
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pluto_actions'
      and policyname = 'Users can insert pluto actions for their business'
  ) then
    create policy "Users can insert pluto actions for their business"
      on public.pluto_actions
      for insert
      with check (
        exists (
          select 1
          from public.business_profiles bp
          where bp.id = pluto_actions.business_profile_id
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
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pluto_actions'
      and policyname = 'Users can update their business pluto actions'
  ) then
    create policy "Users can update their business pluto actions"
      on public.pluto_actions
      for update
      using (
        exists (
          select 1
          from public.business_profiles bp
          where bp.id = pluto_actions.business_profile_id
            and bp.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.business_profiles bp
          where bp.id = pluto_actions.business_profile_id
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
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pluto_actions'
      and policyname = 'Users can delete their business pluto actions'
  ) then
    create policy "Users can delete their business pluto actions"
      on public.pluto_actions
      for delete
      using (
        exists (
          select 1
          from public.business_profiles bp
          where bp.id = pluto_actions.business_profile_id
            and bp.user_id = auth.uid()
        )
      );
  end if;
end
$$;

create or replace function public.handle_pluto_actions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'pluto_actions_updated_at'
      and tgrelid = 'public.pluto_actions'::regclass
  ) then
    create trigger pluto_actions_updated_at
      before update on public.pluto_actions
      for each row
      execute function public.handle_pluto_actions_updated_at();
  end if;
end
$$;
