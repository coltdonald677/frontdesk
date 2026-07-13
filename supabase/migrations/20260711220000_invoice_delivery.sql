-- Pluto Invoice Delivery
-- Additive: delivery tracking separate from invoice financial status.
-- Public access via high-entropy token (SHA-256 hash stored; plain token never persisted).
-- Review and apply manually in Supabase SQL editor.

create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'invoice_delivery_status'
      and n.nspname = 'public'
  ) then
    create type public.invoice_delivery_status as enum (
      'not_sent',
      'sent',
      'opened',
      'delivered',
      'failed'
    );
  end if;
end
$$;

create table if not exists public.invoice_deliveries (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  token_hash text not null,
  delivery_status public.invoice_delivery_status not null default 'not_sent',
  recipient_email text not null,
  message text,
  sent_at timestamptz,
  opened_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  last_error text,
  revoked_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_deliveries_token_hash_len check (char_length(token_hash) = 64)
);

create unique index if not exists invoice_deliveries_token_hash_idx
  on public.invoice_deliveries (token_hash);

create index if not exists invoice_deliveries_invoice_id_idx
  on public.invoice_deliveries (invoice_id, created_at desc);

create index if not exists invoice_deliveries_business_profile_id_idx
  on public.invoice_deliveries (business_profile_id);

alter table public.invoice_deliveries enable row level security;

drop policy if exists "Users can view invoice deliveries for their business"
  on public.invoice_deliveries;

create policy "Users can view invoice deliveries for their business"
  on public.invoice_deliveries for select
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = invoice_deliveries.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert invoice deliveries for their business"
  on public.invoice_deliveries;

create policy "Users can insert invoice deliveries for their business"
  on public.invoice_deliveries for insert
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = invoice_deliveries.business_profile_id
        and bp.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.invoices i
      where i.id = invoice_deliveries.invoice_id
        and i.business_profile_id = invoice_deliveries.business_profile_id
    )
  );

drop policy if exists "Users can update invoice deliveries for their business"
  on public.invoice_deliveries;

create policy "Users can update invoice deliveries for their business"
  on public.invoice_deliveries for update
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = invoice_deliveries.business_profile_id
        and bp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = invoice_deliveries.business_profile_id
        and bp.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.invoices i
      where i.id = invoice_deliveries.invoice_id
        and i.business_profile_id = invoice_deliveries.business_profile_id
    )
  );

create or replace function public.hash_invoice_delivery_token(p_token text)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(
    extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'::text),
    'hex'
  );
$$;

revoke all on function public.hash_invoice_delivery_token(text) from public;

create or replace function public.get_public_invoice_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery record;
  v_invoice record;
  v_business record;
  v_line_items jsonb;
begin
  if p_token is null or char_length(trim(p_token)) < 32 then
    return null;
  end if;

  select d.*
  into v_delivery
  from public.invoice_deliveries d
  where d.token_hash = public.hash_invoice_delivery_token(p_token)
    and d.revoked_at is null
    and d.expires_at > now()
    and d.delivery_status in ('sent', 'opened', 'delivered')
  limit 1;

  if not found then
    return null;
  end if;

  select i.*
  into v_invoice
  from public.invoices i
  where i.id = v_delivery.invoice_id
    and i.business_profile_id = v_delivery.business_profile_id;

  if not found or v_invoice.status = 'void' then
    return null;
  end if;

  select bp.business_name, bp.business_address, bp.phone_number, bp.email
  into v_business
  from public.business_profiles bp
  where bp.id = v_delivery.business_profile_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'description', li.description,
        'quantity', li.quantity,
        'unit_price', li.unit_price,
        'tax_rate', li.tax_rate,
        'line_total', li.line_total
      )
      order by li.sort_order
    ),
    '[]'::jsonb
  )
  into v_line_items
  from public.invoice_line_items li
  where li.invoice_id = v_invoice.id;

  return jsonb_build_object(
    'invoice_number', v_invoice.invoice_number,
    'issue_date', v_invoice.issue_date,
    'due_date', v_invoice.due_date,
    'financial_status', v_invoice.status,
    'subtotal', v_invoice.subtotal,
    'discount_amount', v_invoice.discount_amount,
    'tax_amount', v_invoice.tax_amount,
    'total_amount', v_invoice.total_amount,
    'amount_paid', v_invoice.amount_paid,
    'balance_due', v_invoice.balance_due,
    'customer_message', coalesce(v_delivery.message, v_invoice.customer_message),
    'business_name', v_business.business_name,
    'business_address', v_business.business_address,
    'business_phone', v_business.phone_number,
    'business_email', v_business.email,
    'customer_name', (
      select coalesce(c.company, c.name)
      from public.customers c
      where c.id = v_invoice.customer_id
    ),
    'line_items', v_line_items
  );
end;
$$;

revoke all on function public.get_public_invoice_by_token(text) from public;
grant execute on function public.get_public_invoice_by_token(text) to anon;
grant execute on function public.get_public_invoice_by_token(text) to authenticated;

create or replace function public.record_invoice_delivery_opened(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery record;
  v_first_open boolean := false;
begin
  if p_token is null or char_length(trim(p_token)) < 32 then
    return jsonb_build_object('ok', false);
  end if;

  select d.*
  into v_delivery
  from public.invoice_deliveries d
  where d.token_hash = public.hash_invoice_delivery_token(p_token)
    and d.revoked_at is null
    and d.expires_at > now()
    and d.delivery_status in ('sent', 'opened', 'delivered')
  for update;

  if not found then
    return jsonb_build_object('ok', false);
  end if;

  if v_delivery.opened_at is null then
    v_first_open := true;
    update public.invoice_deliveries
    set
      opened_at = now(),
      delivery_status = 'opened',
      updated_at = now()
    where id = v_delivery.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'first_open', v_first_open,
    'invoice_id', v_delivery.invoice_id,
    'business_profile_id', v_delivery.business_profile_id,
    'invoice_number', (
      select i.invoice_number
      from public.invoices i
      where i.id = v_delivery.invoice_id
    )
  );
end;
$$;

revoke all on function public.record_invoice_delivery_opened(text) from public;
grant execute on function public.record_invoice_delivery_opened(text) to anon;
grant execute on function public.record_invoice_delivery_opened(text) to authenticated;

create or replace function public.revoke_invoice_deliveries_on_void()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'void'::public.invoice_status
     and old.status is distinct from 'void'::public.invoice_status then
    update public.invoice_deliveries
    set revoked_at = now(), updated_at = now()
    where invoice_id = new.id
      and revoked_at is null;
  end if;

  return new;
end;
$$;

drop trigger if exists invoices_revoke_deliveries_on_void on public.invoices;

create trigger invoices_revoke_deliveries_on_void
  after update on public.invoices
  for each row
  execute function public.revoke_invoice_deliveries_on_void();

create or replace function public.handle_invoice_deliveries_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists invoice_deliveries_updated_at on public.invoice_deliveries;

create trigger invoice_deliveries_updated_at
  before update on public.invoice_deliveries
  for each row
  execute function public.handle_invoice_deliveries_updated_at();
