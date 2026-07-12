-- Pluto Security Hardening Phase 2B (F-005, F-006, F-009, F-010) — REVISED
-- Additive only: replaces RLS policies, adds validation triggers and secure payment RPC.
-- Review and apply manually in Supabase SQL editor.
--
-- Payment-write architecture (v1):
--   * All payment creation goes through record_invoice_payment_secure (SECURITY INVOKER).
--   * RPC sets a transaction-local session flag, inserts the payment row, and updates
--     invoice aggregates atomically under an invoice row lock (FOR UPDATE).
--   * Direct authenticated INSERT on invoice_payments is blocked by a BEFORE INSERT
--     trigger unless the session flag is set (not settable via PostgREST Data API).
--   * Direct authenticated UPDATE/DELETE on invoice_payments is denied by RLS (policies
--     removed) and blocked by BEFORE UPDATE/DELETE triggers (no reversal workflow).
--   * Direct manipulation of invoices.amount_paid / balance_due is blocked unless the
--     same session flag is set inside the RPC transaction.
--   * Invoice total_amount cannot be reduced below amount_paid when payments exist;
--     balance_due must stay non-negative and amount_paid + balance_due must equal total_amount.
--   * paid / partially_paid status invariants are enforced on every financial update,
--     even when the status value itself does not change.

-- ---------------------------------------------------------------------------
-- F-005: Invoice INSERT/UPDATE RLS — enforce customer and appointment ownership
-- ---------------------------------------------------------------------------

drop policy if exists "Users can insert invoices for their business" on public.invoices;

create policy "Users can insert invoices for their business"
  on public.invoices for insert
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = invoices.business_profile_id
        and bp.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.customers c
      where c.id = invoices.customer_id
        and c.business_profile_id = invoices.business_profile_id
    )
    and (
      invoices.appointment_id is null
      or exists (
        select 1
        from public.appointments a
        where a.id = invoices.appointment_id
          and a.business_profile_id = invoices.business_profile_id
          and a.customer_id = invoices.customer_id
      )
    )
  );

drop policy if exists "Users can update their business invoices" on public.invoices;

create policy "Users can update their business invoices"
  on public.invoices for update
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = invoices.business_profile_id
        and bp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = invoices.business_profile_id
        and bp.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.customers c
      where c.id = invoices.customer_id
        and c.business_profile_id = invoices.business_profile_id
    )
    and (
      invoices.appointment_id is null
      or exists (
        select 1
        from public.appointments a
        where a.id = invoices.appointment_id
          and a.business_profile_id = invoices.business_profile_id
          and a.customer_id = invoices.customer_id
      )
    )
  );

-- ---------------------------------------------------------------------------
-- F-006: invoice_payments RLS — SELECT only; no direct authenticated writes
-- ---------------------------------------------------------------------------
-- UPDATE and DELETE policies are intentionally NOT recreated (default deny under RLS).
-- INSERT policy remains so SECURITY INVOKER RPC can insert; a BEFORE INSERT trigger
-- blocks all inserts unless the RPC session flag is set in the same transaction.

drop policy if exists "Users can view invoice payments for their business" on public.invoice_payments;

create policy "Users can view invoice payments for their business"
  on public.invoice_payments for select
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = invoice_payments.business_profile_id
        and bp.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.invoices i
      where i.id = invoice_payments.invoice_id
        and i.business_profile_id = invoice_payments.business_profile_id
    )
  );

drop policy if exists "Users can insert invoice payments for their business" on public.invoice_payments;

create policy "Users can insert invoice payments for their business"
  on public.invoice_payments for insert
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = invoice_payments.business_profile_id
        and bp.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.invoices i
      where i.id = invoice_payments.invoice_id
        and i.business_profile_id = invoice_payments.business_profile_id
    )
  );

drop policy if exists "Users can update invoice payments for their business" on public.invoice_payments;
drop policy if exists "Users can delete invoice payments for their business" on public.invoice_payments;

-- ---------------------------------------------------------------------------
-- Shared payment amount validation (precision + positivity)
-- ---------------------------------------------------------------------------

create or replace function public.assert_payment_amount_valid(p_amount numeric)
returns void
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  if p_amount <> round(p_amount, 2) then
    raise exception 'Payment amount cannot have more than two decimal places';
  end if;
end;
$$;

revoke all on function public.assert_payment_amount_valid(numeric) from public;
revoke all on function public.assert_payment_amount_valid(numeric) from anon;
grant execute on function public.assert_payment_amount_valid(numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- F-009: RPC-only payment insert gate + overpayment defense in depth
-- ---------------------------------------------------------------------------

create or replace function public.gate_invoice_payment_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_invoice record;
  v_paid numeric(12, 2);
begin
  if current_setting('pluto.allow_payment_write', true) is distinct from '1' then
    raise exception
      'Direct payment writes are not allowed. Use record_invoice_payment_secure.';
  end if;

  perform public.assert_payment_amount_valid(new.amount);

  select *
  into v_invoice
  from public.invoices
  where id = new.invoice_id
  for update;

  if not found then
    raise exception 'Invoice not found';
  end if;

  if v_invoice.business_profile_id is distinct from new.business_profile_id then
    raise exception 'Invoice does not belong to this business';
  end if;

  if v_invoice.status = 'void' then
    raise exception 'Cannot record payment on a void invoice';
  end if;

  select coalesce(sum(amount), 0)
  into v_paid
  from public.invoice_payments
  where invoice_id = new.invoice_id;

  if v_paid + new.amount > v_invoice.total_amount then
    raise exception 'Payment exceeds remaining balance';
  end if;

  return new;
end;
$$;

revoke all on function public.gate_invoice_payment_insert() from public;
revoke all on function public.gate_invoice_payment_insert() from anon;

drop trigger if exists invoice_payments_validate_amount on public.invoice_payments;
drop trigger if exists invoice_payments_gate_insert on public.invoice_payments;

create trigger invoice_payments_gate_insert
  before insert on public.invoice_payments
  for each row
  execute function public.gate_invoice_payment_insert();

-- ---------------------------------------------------------------------------
-- Block payment UPDATE/DELETE (no reversal/refund workflow in v1)
-- ---------------------------------------------------------------------------

create or replace function public.block_invoice_payment_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception
    'Payment records cannot be modified or deleted. Pluto does not support payment reversals or refunds.';
end;
$$;

revoke all on function public.block_invoice_payment_mutation() from public;
revoke all on function public.block_invoice_payment_mutation() from anon;

drop trigger if exists invoice_payments_block_update on public.invoice_payments;
drop trigger if exists invoice_payments_block_delete on public.invoice_payments;

create trigger invoice_payments_block_update
  before update on public.invoice_payments
  for each row
  execute function public.block_invoice_payment_mutation();

create trigger invoice_payments_block_delete
  before delete on public.invoice_payments
  for each row
  execute function public.block_invoice_payment_mutation();

-- ---------------------------------------------------------------------------
-- Block direct invoice aggregate tampering + enforce total integrity after payments
-- ---------------------------------------------------------------------------

create or replace function public.enforce_invoice_financial_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_has_payments boolean;
begin
  if new.balance_due < 0 then
    raise exception 'Invoice balance due cannot be negative';
  end if;

  if current_setting('pluto.allow_payment_write', true) = '1' then
    if round(new.amount_paid + new.balance_due, 2)
       <> round(new.total_amount, 2) then
      raise exception
        'Invoice amount_paid and balance_due must equal total_amount';
    end if;
    return new;
  end if;

  if new.amount_paid is distinct from old.amount_paid then
    raise exception
      'Invoice payment totals can only be updated through record_invoice_payment_secure';
  end if;

  v_has_payments := old.amount_paid > 0
    or exists (
      select 1
      from public.invoice_payments ip
      where ip.invoice_id = old.id
      limit 1
    );

  if v_has_payments and new.total_amount < old.amount_paid then
    raise exception
      'Invoice total cannot be reduced below amount already paid';
  end if;

  if new.amount_paid = 0
     and new.status in (
       'paid'::public.invoice_status,
       'partially_paid'::public.invoice_status
     ) then
    raise exception
      'Invoice cannot be paid or partially paid with zero amount_paid';
  end if;

  if new.balance_due = 0
     and new.amount_paid = new.total_amount
     and new.status = 'partially_paid'::public.invoice_status then
    raise exception
      'Invoice cannot remain partially paid when fully settled';
  end if;

  if new.status = 'paid'::public.invoice_status then
    if new.amount_paid is distinct from new.total_amount then
      raise exception
        'Paid invoices must have amount_paid equal to total_amount';
    end if;

    if new.balance_due <> 0 then
      raise exception 'Paid invoices must have zero balance_due';
    end if;

    if not v_has_payments and new.amount_paid <= 0 then
      raise exception 'Paid invoices must have recorded payment history';
    end if;
  end if;

  if new.status = 'partially_paid'::public.invoice_status then
    if new.amount_paid <= 0 then
      raise exception
        'Partially paid invoices must have amount_paid greater than zero';
    end if;

    if new.amount_paid >= new.total_amount then
      raise exception
        'Partially paid invoices must have amount_paid less than total_amount';
    end if;

    if new.balance_due <= 0 then
      raise exception
        'Partially paid invoices must have balance_due greater than zero';
    end if;
  end if;

  if round(new.amount_paid + new.balance_due, 2)
     <> round(new.total_amount, 2) then
    raise exception
      'Invoice amount_paid and balance_due must equal total_amount';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_invoice_financial_update() from public;
revoke all on function public.enforce_invoice_financial_update() from anon;

drop trigger if exists invoices_gate_payment_aggregate_update on public.invoices;
drop trigger if exists invoices_enforce_financial_update on public.invoices;
drop function if exists public.gate_invoice_payment_aggregate_update();

create trigger invoices_enforce_financial_update
  before update on public.invoices
  for each row
  execute function public.enforce_invoice_financial_update();

-- ---------------------------------------------------------------------------
-- record_invoice_payment_secure — sole payment write path
-- Locks invoice row (FOR UPDATE) for concurrent payment serialization.
-- ---------------------------------------------------------------------------

create or replace function public.record_invoice_payment_secure(
  p_invoice_id uuid,
  p_business_profile_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_invoice record;
  v_paid numeric(12, 2);
  v_new_paid numeric(12, 2);
  v_balance numeric(12, 2);
  v_status public.invoice_status;
  v_payment_id uuid;
begin
  if not exists (
    select 1
    from public.business_profiles bp
    where bp.id = p_business_profile_id
      and bp.user_id = auth.uid()
  ) then
    raise exception 'Unauthorized';
  end if;

  perform public.assert_payment_amount_valid(p_amount);

  perform set_config('pluto.allow_payment_write', '1', true);

  select *
  into v_invoice
  from public.invoices
  where id = p_invoice_id
    and business_profile_id = p_business_profile_id
  for update;

  if not found then
    raise exception 'Invoice not found';
  end if;

  if v_invoice.status = 'void' then
    raise exception 'Cannot record payment on a void invoice';
  end if;

  select coalesce(sum(amount), 0)
  into v_paid
  from public.invoice_payments
  where invoice_id = p_invoice_id;

  if v_paid + p_amount > v_invoice.total_amount then
    raise exception 'Payment exceeds remaining balance';
  end if;

  insert into public.invoice_payments (
    invoice_id,
    business_profile_id,
    amount,
    payment_date,
    note,
    source
  )
  values (
    p_invoice_id,
    p_business_profile_id,
    p_amount,
    p_payment_date,
    nullif(trim(p_note), ''),
    'manual'
  )
  returning id into v_payment_id;

  v_new_paid := v_paid + p_amount;
  v_balance := greatest(0, v_invoice.total_amount - v_new_paid);

  if v_new_paid >= v_invoice.total_amount then
    v_status := 'paid';
  else
    v_status := 'partially_paid';
  end if;

  update public.invoices
  set
    amount_paid = v_new_paid,
    balance_due = v_balance,
    status = v_status
  where id = p_invoice_id
    and business_profile_id = p_business_profile_id;

  return v_payment_id;
end;
$$;

revoke all on function public.record_invoice_payment_secure(
  uuid,
  uuid,
  numeric,
  date,
  text
) from public;

revoke all on function public.record_invoice_payment_secure(
  uuid,
  uuid,
  numeric,
  date,
  text
) from anon;

grant execute on function public.record_invoice_payment_secure(
  uuid,
  uuid,
  numeric,
  date,
  text
) to authenticated;

-- ---------------------------------------------------------------------------
-- F-010: Block unsafe voiding of invoices with payment history
-- ---------------------------------------------------------------------------

create or replace function public.prevent_unsafe_invoice_void()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status is distinct from 'void'::public.invoice_status
     and new.status = 'void'::public.invoice_status then
    if old.status = 'paid'::public.invoice_status
       or old.amount_paid > 0
       or exists (
         select 1
         from public.invoice_payments ip
         where ip.invoice_id = old.id
         limit 1
       ) then
      raise exception 'Cannot void invoice with recorded payments';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_unsafe_invoice_void() from public;
revoke all on function public.prevent_unsafe_invoice_void() from anon;

drop trigger if exists invoices_prevent_unsafe_void on public.invoices;

create trigger invoices_prevent_unsafe_void
  before update on public.invoices
  for each row
  execute function public.prevent_unsafe_invoice_void();
