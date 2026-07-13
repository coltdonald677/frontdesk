-- Pluto Brain Phase 1: usage logs, audit logs, action idempotency (additive)
-- Logging writes are RPC-only. Review and apply manually in Supabase SQL editor.

create table if not exists public.brain_usage_logs (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  user_id uuid not null,
  provider_id text not null,
  request_type text not null check (request_type in ('question', 'briefing')),
  success boolean not null default false,
  from_cache boolean not null default false,
  error_code text,
  created_at timestamptz not null default now()
);

create index if not exists brain_usage_logs_business_created_idx
  on public.brain_usage_logs (business_profile_id, created_at desc);

create index if not exists brain_usage_logs_business_day_idx
  on public.brain_usage_logs (business_profile_id, created_at)
  where from_cache = false;

alter table public.brain_usage_logs enable row level security;

drop policy if exists "Users can view brain usage for their business"
  on public.brain_usage_logs;

create policy "Users can view brain usage for their business"
  on public.brain_usage_logs for select
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = brain_usage_logs.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert brain usage for their business"
  on public.brain_usage_logs;

create table if not exists public.brain_audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  user_id uuid not null,
  event_type text not null,
  tool_name text,
  action_id uuid references public.pluto_actions (id) on delete set null,
  outcome text not null check (outcome in ('success', 'failure', 'blocked')),
  summary text not null,
  record_type text,
  record_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists brain_audit_logs_business_created_idx
  on public.brain_audit_logs (business_profile_id, created_at desc);

alter table public.brain_audit_logs enable row level security;

drop policy if exists "Users can view brain audit logs for their business"
  on public.brain_audit_logs;

create policy "Users can view brain audit logs for their business"
  on public.brain_audit_logs for select
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = brain_audit_logs.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert brain audit logs for their business"
  on public.brain_audit_logs;

do $$
declare
  v_constraint_exists boolean;
  v_oversized_count integer;
begin
  select exists (
    select 1
    from pg_constraint
    where conname = 'brain_audit_logs_summary_len'
      and conrelid = 'public.brain_audit_logs'::regclass
  )
  into v_constraint_exists;

  if not v_constraint_exists then
    select count(*)
    into v_oversized_count
    from public.brain_audit_logs
    where char_length(summary) > 500;

    if v_oversized_count > 0 then
      raise exception
        'Cannot add brain_audit_logs_summary_len: % existing audit summary row(s) exceed 500 characters. Shorten summaries manually before rerunning this migration.',
        v_oversized_count;
    end if;

    alter table public.brain_audit_logs
      add constraint brain_audit_logs_summary_len
      check (char_length(summary) <= 500);
  end if;
end
$$;

revoke insert, update, delete, truncate on public.brain_usage_logs from anon, authenticated;
revoke insert, update, delete, truncate on public.brain_audit_logs from anon, authenticated;

create or replace function public.sanitize_brain_audit_summary(p_summary text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_summary text;
begin
  if p_summary is null then
    return null;
  end if;

  v_summary := left(trim(p_summary), 500);
  v_summary := regexp_replace(v_summary, 'api[_-]?key', '[redacted]', 'gi');
  v_summary := regexp_replace(v_summary, 'password', '[redacted]', 'gi');
  v_summary := regexp_replace(v_summary, 'secret', '[redacted]', 'gi');
  v_summary := regexp_replace(v_summary, 'bearer\s+', '[redacted] ', 'gi');
  v_summary := regexp_replace(v_summary, 'authorization', '[redacted]', 'gi');
  v_summary := regexp_replace(v_summary, 'system\s+prompt', '[redacted]', 'gi');
  v_summary := regexp_replace(v_summary, 'hidden\s+reasoning', '[redacted]', 'gi');
  v_summary := regexp_replace(v_summary, 'chain-of-thought', '[redacted]', 'gi');
  v_summary := regexp_replace(v_summary, '```', '[redacted]', 'g');

  return nullif(trim(v_summary), '');
end;
$$;

create or replace function public.record_brain_usage_event(
  p_business_profile_id uuid,
  p_provider_id text,
  p_request_type text,
  p_success boolean,
  p_from_cache boolean default false,
  p_error_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_log_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_business_profile_id is null then
    raise exception 'Business is required';
  end if;

  if not exists (
    select 1
    from public.business_profiles bp
    where bp.id = p_business_profile_id
      and bp.user_id = v_user_id
  ) then
    raise exception 'Business not found';
  end if;

  if p_provider_id is null
     or char_length(trim(p_provider_id)) = 0
     or char_length(p_provider_id) > 64
     or p_provider_id !~ '^[a-z0-9._-]+$'
     or p_provider_id not in ('openai-compatible', 'development-fallback') then
    raise exception 'Invalid provider';
  end if;

  if p_request_type not in ('question', 'briefing') then
    raise exception 'Invalid request type';
  end if;

  if p_error_code is not null
     and (
       char_length(p_error_code) > 64
       or p_error_code !~ '^[a-zA-Z0-9_.-]+$'
     ) then
    raise exception 'Invalid error code';
  end if;

  insert into public.brain_usage_logs (
    business_profile_id,
    user_id,
    provider_id,
    request_type,
    success,
    from_cache,
    error_code
  )
  values (
    p_business_profile_id,
    v_user_id,
    trim(p_provider_id),
    p_request_type,
    coalesce(p_success, false),
    coalesce(p_from_cache, false),
    nullif(trim(p_error_code), '')
  )
  returning id into v_log_id;

  return v_log_id;
end;
$$;

create or replace function public.record_brain_audit_event(
  p_business_profile_id uuid,
  p_event_type text,
  p_outcome text,
  p_summary text,
  p_tool_name text default null,
  p_action_id uuid default null,
  p_record_type text default null,
  p_record_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_summary text;
  v_log_id uuid;
  v_record_valid boolean := false;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_business_profile_id is null then
    raise exception 'Business is required';
  end if;

  if not exists (
    select 1
    from public.business_profiles bp
    where bp.id = p_business_profile_id
      and bp.user_id = v_user_id
  ) then
    raise exception 'Business not found';
  end if;

  if p_event_type is null
     or char_length(p_event_type) > 64
     or p_event_type not in (
       'brain.question',
       'brain.briefing',
       'brain.write.blocked',
       'brain.write.create_task',
       'brain.write.mark_task_complete',
       'brain.write.create_appointment',
       'brain.write.reschedule_appointment',
       'brain.write.assign_employee',
       'brain.write.create_customer_note',
       'brain.write.create_invoice',
       'brain.write.create_follow_up'
     ) then
    raise exception 'Invalid event type';
  end if;

  if p_outcome not in ('success', 'failure', 'blocked') then
    raise exception 'Invalid outcome';
  end if;

  v_summary := public.sanitize_brain_audit_summary(p_summary);
  if v_summary is null then
    raise exception 'Audit summary is required';
  end if;

  if p_tool_name is not null
     and (
       char_length(trim(p_tool_name)) = 0
       or char_length(p_tool_name) > 64
       or trim(p_tool_name) !~ '^[a-z0-9_]+$'
     ) then
    raise exception 'Invalid tool name';
  end if;

  if p_record_type is not null
     and p_record_type not in ('customer', 'employee', 'appointment', 'task', 'invoice') then
    raise exception 'Invalid record type';
  end if;

  if p_record_id is not null and p_record_type is null then
    raise exception 'Invalid record reference';
  end if;

  if p_record_type is not null and p_record_id is null then
    raise exception 'Invalid record reference';
  end if;

  if p_record_id is not null then
    case p_record_type
      when 'customer' then
        select exists (
          select 1
          from public.customers c
          where c.id = p_record_id
            and c.business_profile_id = p_business_profile_id
        )
        into v_record_valid;
      when 'employee' then
        select exists (
          select 1
          from public.employees e
          where e.id = p_record_id
            and e.business_profile_id = p_business_profile_id
        )
        into v_record_valid;
      when 'appointment' then
        select exists (
          select 1
          from public.appointments a
          where a.id = p_record_id
            and a.business_profile_id = p_business_profile_id
        )
        into v_record_valid;
      when 'task' then
        select exists (
          select 1
          from public.tasks t
          where t.id = p_record_id
            and t.business_profile_id = p_business_profile_id
        )
        into v_record_valid;
      when 'invoice' then
        select exists (
          select 1
          from public.invoices i
          where i.id = p_record_id
            and i.business_profile_id = p_business_profile_id
        )
        into v_record_valid;
      else
        v_record_valid := false;
    end case;

    if not v_record_valid then
      raise exception 'Invalid record reference';
    end if;
  end if;

  if p_action_id is not null
     and not exists (
       select 1
       from public.pluto_actions pa
       where pa.id = p_action_id
         and pa.business_profile_id = p_business_profile_id
     ) then
    raise exception 'Invalid action reference';
  end if;

  insert into public.brain_audit_logs (
    business_profile_id,
    user_id,
    event_type,
    tool_name,
    action_id,
    outcome,
    summary,
    record_type,
    record_id
  )
  values (
    p_business_profile_id,
    v_user_id,
    p_event_type,
    nullif(trim(p_tool_name), ''),
    p_action_id,
    p_outcome,
    v_summary,
    p_record_type,
    p_record_id
  )
  returning id into v_log_id;

  return v_log_id;
end;
$$;

revoke all on function public.sanitize_brain_audit_summary(text) from public;
revoke all on function public.sanitize_brain_audit_summary(text) from anon;

revoke all on function public.record_brain_usage_event(
  uuid, text, text, boolean, boolean, text
) from public;
revoke all on function public.record_brain_usage_event(
  uuid, text, text, boolean, boolean, text
) from anon;
grant execute on function public.record_brain_usage_event(
  uuid, text, text, boolean, boolean, text
) to authenticated;

revoke all on function public.record_brain_audit_event(
  uuid, text, text, text, text, uuid, text, uuid
) from public;
revoke all on function public.record_brain_audit_event(
  uuid, text, text, text, text, uuid, text, uuid
) from anon;
grant execute on function public.record_brain_audit_event(
  uuid, text, text, text, text, uuid, text, uuid
) to authenticated;

alter table public.pluto_actions
  add column if not exists idempotency_key text;

do $$
declare
  v_duplicate_groups integer;
  v_duplicate_summary text;
begin
  select count(*)
  into v_duplicate_groups
  from (
    select
      pa.business_profile_id,
      pa.idempotency_key
    from public.pluto_actions pa
    where pa.idempotency_key is not null
      and pa.status in (
        'proposed'::public.pluto_action_status,
        'approved'::public.pluto_action_status,
        'executing'::public.pluto_action_status,
        'completed'::public.pluto_action_status
      )
    group by pa.business_profile_id, pa.idempotency_key
    having count(*) > 1
  ) duplicates;

  if v_duplicate_groups > 0 then
    select coalesce(
      string_agg(
        format(
          'business=%s groups=1 rows=%s key_prefix=%s',
          d.business_profile_id,
          d.row_count,
          left(d.idempotency_key, 8)
        ),
        '; '
      ),
      ''
    )
    into v_duplicate_summary
    from (
      select
        pa.business_profile_id,
        pa.idempotency_key,
        count(*) as row_count
      from public.pluto_actions pa
      where pa.idempotency_key is not null
        and pa.status in (
          'proposed'::public.pluto_action_status,
          'approved'::public.pluto_action_status,
          'executing'::public.pluto_action_status,
          'completed'::public.pluto_action_status
        )
      group by pa.business_profile_id, pa.idempotency_key
      having count(*) > 1
      limit 5
    ) d;

    raise exception
      'Cannot create pluto_actions idempotency index: % duplicate active idempotency key group(s) found. Resolve duplicates manually before rerunning this migration. %',
      v_duplicate_groups,
      v_duplicate_summary;
  end if;
end
$$;

-- Block duplicate active/completed actions with the same idempotency key.
-- failed and rejected are intentionally excluded so a retried action may be proposed again.
drop index if exists pluto_actions_idempotency_key_idx;

create unique index if not exists pluto_actions_idempotency_key_idx
  on public.pluto_actions (business_profile_id, idempotency_key)
  where idempotency_key is not null
    and status in (
      'proposed'::public.pluto_action_status,
      'approved'::public.pluto_action_status,
      'executing'::public.pluto_action_status,
      'completed'::public.pluto_action_status
    );
