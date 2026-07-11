-- Pluto Invoices v1 (idempotent)

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'invoice_status'
      and n.nspname = 'public'
  ) then
    create type public.invoice_status as enum (
      'draft',
      'sent',
      'viewed',
      'partially_paid',
      'paid',
      'overdue',
      'void'
    );
  end if;
end
$$;

create table if not exists public.invoice_number_sequences (
  business_profile_id uuid primary key references public.business_profiles (id) on delete cascade,
  last_number integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  appointment_id uuid references public.appointments (id) on delete set null,
  invoice_number text not null,
  status public.invoice_status not null default 'draft',
  issue_date date not null,
  due_date date,
  subtotal numeric(12, 2) not null default 0,
  discount_amount numeric(12, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  amount_paid numeric(12, 2) not null default 0,
  balance_due numeric(12, 2) not null default 0,
  notes text,
  customer_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_discount_non_negative check (discount_amount >= 0),
  constraint invoices_amount_paid_non_negative check (amount_paid >= 0),
  constraint invoices_totals_non_negative check (
    subtotal >= 0
    and tax_amount >= 0
    and total_amount >= 0
    and balance_due >= 0
  )
);

create unique index if not exists invoices_business_invoice_number_idx
  on public.invoices (business_profile_id, invoice_number);

create index if not exists invoices_business_profile_id_idx
  on public.invoices (business_profile_id);

create index if not exists invoices_customer_id_idx
  on public.invoices (customer_id);

create index if not exists invoices_appointment_id_idx
  on public.invoices (appointment_id)
  where appointment_id is not null;

create index if not exists invoices_status_idx
  on public.invoices (business_profile_id, status, issue_date desc);

create index if not exists invoices_due_date_idx
  on public.invoices (business_profile_id, due_date)
  where due_date is not null;

create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  description text not null,
  quantity numeric(12, 2) not null default 1,
  unit_price numeric(12, 2) not null,
  tax_rate numeric(5, 2) not null default 0,
  line_total numeric(12, 2) not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint invoice_line_items_quantity_positive check (quantity > 0),
  constraint invoice_line_items_unit_price_non_negative check (unit_price >= 0),
  constraint invoice_line_items_tax_rate_non_negative check (tax_rate >= 0),
  constraint invoice_line_items_line_total_non_negative check (line_total >= 0)
);

create index if not exists invoice_line_items_invoice_id_idx
  on public.invoice_line_items (invoice_id, sort_order);

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  amount numeric(12, 2) not null,
  payment_date date not null,
  note text,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  constraint invoice_payments_amount_positive check (amount > 0)
);

create index if not exists invoice_payments_invoice_id_idx
  on public.invoice_payments (invoice_id, payment_date desc);

create index if not exists invoice_payments_business_profile_id_idx
  on public.invoice_payments (business_profile_id);

alter table public.invoices enable row level security;
alter table public.invoice_line_items enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.invoice_number_sequences enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoices'
      and policyname = 'Users can view their business invoices'
  ) then
    create policy "Users can view their business invoices"
      on public.invoices for select
      using (
        exists (
          select 1 from public.business_profiles bp
          where bp.id = invoices.business_profile_id and bp.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoices'
      and policyname = 'Users can insert invoices for their business'
  ) then
    create policy "Users can insert invoices for their business"
      on public.invoices for insert
      with check (
        exists (
          select 1 from public.business_profiles bp
          where bp.id = invoices.business_profile_id and bp.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoices'
      and policyname = 'Users can update their business invoices'
  ) then
    create policy "Users can update their business invoices"
      on public.invoices for update
      using (
        exists (
          select 1 from public.business_profiles bp
          where bp.id = invoices.business_profile_id and bp.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.business_profiles bp
          where bp.id = invoices.business_profile_id and bp.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoices'
      and policyname = 'Users can delete their business invoices'
  ) then
    create policy "Users can delete their business invoices"
      on public.invoices for delete
      using (
        exists (
          select 1 from public.business_profiles bp
          where bp.id = invoices.business_profile_id and bp.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoice_line_items'
      and policyname = 'Users can view invoice line items for their business'
  ) then
    create policy "Users can view invoice line items for their business"
      on public.invoice_line_items for select
      using (
        exists (
          select 1
          from public.invoices i
          join public.business_profiles bp on bp.id = i.business_profile_id
          where i.id = invoice_line_items.invoice_id and bp.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoice_line_items'
      and policyname = 'Users can insert invoice line items for their business'
  ) then
    create policy "Users can insert invoice line items for their business"
      on public.invoice_line_items for insert
      with check (
        exists (
          select 1
          from public.invoices i
          join public.business_profiles bp on bp.id = i.business_profile_id
          where i.id = invoice_line_items.invoice_id and bp.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoice_line_items'
      and policyname = 'Users can update invoice line items for their business'
  ) then
    create policy "Users can update invoice line items for their business"
      on public.invoice_line_items for update
      using (
        exists (
          select 1
          from public.invoices i
          join public.business_profiles bp on bp.id = i.business_profile_id
          where i.id = invoice_line_items.invoice_id and bp.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.invoices i
          join public.business_profiles bp on bp.id = i.business_profile_id
          where i.id = invoice_line_items.invoice_id and bp.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoice_line_items'
      and policyname = 'Users can delete invoice line items for their business'
  ) then
    create policy "Users can delete invoice line items for their business"
      on public.invoice_line_items for delete
      using (
        exists (
          select 1
          from public.invoices i
          join public.business_profiles bp on bp.id = i.business_profile_id
          where i.id = invoice_line_items.invoice_id and bp.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoice_payments'
      and policyname = 'Users can view invoice payments for their business'
  ) then
    create policy "Users can view invoice payments for their business"
      on public.invoice_payments for select
      using (
        exists (
          select 1 from public.business_profiles bp
          where bp.id = invoice_payments.business_profile_id and bp.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoice_payments'
      and policyname = 'Users can insert invoice payments for their business'
  ) then
    create policy "Users can insert invoice payments for their business"
      on public.invoice_payments for insert
      with check (
        exists (
          select 1 from public.business_profiles bp
          where bp.id = invoice_payments.business_profile_id and bp.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoice_payments'
      and policyname = 'Users can update invoice payments for their business'
  ) then
    create policy "Users can update invoice payments for their business"
      on public.invoice_payments for update
      using (
        exists (
          select 1 from public.business_profiles bp
          where bp.id = invoice_payments.business_profile_id and bp.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.business_profiles bp
          where bp.id = invoice_payments.business_profile_id and bp.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoice_payments'
      and policyname = 'Users can delete invoice payments for their business'
  ) then
    create policy "Users can delete invoice payments for their business"
      on public.invoice_payments for delete
      using (
        exists (
          select 1 from public.business_profiles bp
          where bp.id = invoice_payments.business_profile_id and bp.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoice_number_sequences'
      and policyname = 'Users can view invoice sequences for their business'
  ) then
    create policy "Users can view invoice sequences for their business"
      on public.invoice_number_sequences for select
      using (
        exists (
          select 1 from public.business_profiles bp
          where bp.id = invoice_number_sequences.business_profile_id and bp.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoice_number_sequences'
      and policyname = 'Users can insert invoice sequences for their business'
  ) then
    create policy "Users can insert invoice sequences for their business"
      on public.invoice_number_sequences for insert
      with check (
        exists (
          select 1 from public.business_profiles bp
          where bp.id = invoice_number_sequences.business_profile_id and bp.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoice_number_sequences'
      and policyname = 'Users can update invoice sequences for their business'
  ) then
    create policy "Users can update invoice sequences for their business"
      on public.invoice_number_sequences for update
      using (
        exists (
          select 1 from public.business_profiles bp
          where bp.id = invoice_number_sequences.business_profile_id and bp.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.business_profiles bp
          where bp.id = invoice_number_sequences.business_profile_id and bp.user_id = auth.uid()
        )
      );
  end if;
end
$$;

create or replace function public.handle_invoices_updated_at()
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
    select 1 from pg_trigger
    where tgname = 'invoices_updated_at'
      and tgrelid = 'public.invoices'::regclass
  ) then
    create trigger invoices_updated_at
      before update on public.invoices
      for each row
      execute function public.handle_invoices_updated_at();
  end if;
end
$$;

create or replace function public.next_invoice_number(p_business_profile_id uuid)
returns text
language plpgsql
as $$
declare
  v_next integer;
begin
  insert into public.invoice_number_sequences (business_profile_id, last_number)
  values (p_business_profile_id, 1)
  on conflict (business_profile_id)
  do update
    set last_number = public.invoice_number_sequences.last_number + 1,
        updated_at = now()
  returning last_number into v_next;

  return 'INV-' || lpad(v_next::text, 4, '0');
end;
$$;
