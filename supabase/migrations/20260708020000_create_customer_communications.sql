-- Unified customer communications hub (notes, calls, emails, attachments)
-- Designed for future Gmail/Outlook sync into the same history

create type public.communication_channel as enum ('note', 'phone_call', 'email');

create type public.email_provider as enum ('manual', 'gmail', 'outlook');

create type public.email_direction as enum ('inbound', 'outbound');

create type public.email_sync_status as enum ('local', 'pending', 'synced', 'failed');

create type public.phone_call_outcome as enum (
  'connected',
  'voicemail',
  'no_answer',
  'busy',
  'wrong_number',
  'other'
);

create type public.attachment_category as enum (
  'photo',
  'pdf',
  'invoice',
  'document',
  'other'
);

-- Base record for every communication event
create table if not exists public.customer_communications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  channel public.communication_channel not null,
  title text,
  occurred_at timestamptz not null default now(),
  employee_id uuid references public.employees (id) on delete set null,
  external_id text,
  external_thread_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_communications_customer_id_idx
  on public.customer_communications (customer_id);

create index if not exists customer_communications_business_profile_id_idx
  on public.customer_communications (business_profile_id);

create index if not exists customer_communications_occurred_at_idx
  on public.customer_communications (customer_id, occurred_at desc);

create index if not exists customer_communications_channel_idx
  on public.customer_communications (customer_id, channel);

create index if not exists customer_communications_external_id_idx
  on public.customer_communications (business_profile_id, external_id)
  where external_id is not null;

-- Rich-text notes
create table if not exists public.customer_communication_notes (
  communication_id uuid primary key references public.customer_communications (id) on delete cascade,
  body_html text not null,
  body_text text not null default ''
);

-- Phone call log
create table if not exists public.customer_communication_calls (
  communication_id uuid primary key references public.customer_communications (id) on delete cascade,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  outcome public.phone_call_outcome not null default 'connected',
  follow_up_required boolean not null default false,
  summary text
);

-- Email records (manual now; Gmail/Outlook sync later)
create table if not exists public.customer_communication_emails (
  communication_id uuid primary key references public.customer_communications (id) on delete cascade,
  direction public.email_direction not null default 'outbound',
  subject text not null,
  from_address text not null,
  to_addresses text[] not null default '{}',
  cc_addresses text[] not null default '{}',
  body_html text,
  body_preview text not null default '',
  provider public.email_provider not null default 'manual',
  sync_status public.email_sync_status not null default 'local',
  external_message_id text,
  sent_at timestamptz,
  received_at timestamptz
);

create index if not exists customer_communication_emails_external_message_id_idx
  on public.customer_communication_emails (external_message_id)
  where external_message_id is not null;

-- File attachments (photos, PDFs, invoices, documents)
create table if not exists public.customer_communication_attachments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  communication_id uuid references public.customer_communications (id) on delete set null,
  file_name text not null,
  file_size bigint not null check (file_size >= 0),
  mime_type text not null,
  storage_path text not null,
  category public.attachment_category not null default 'document',
  created_at timestamptz not null default now()
);

create index if not exists customer_communication_attachments_customer_id_idx
  on public.customer_communication_attachments (customer_id, created_at desc);

create index if not exists customer_communication_attachments_communication_id_idx
  on public.customer_communication_attachments (communication_id)
  where communication_id is not null;

-- updated_at trigger for communications
create or replace function public.set_customer_communications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger customer_communications_updated_at
  before update on public.customer_communications
  for each row
  execute function public.set_customer_communications_updated_at();

-- RLS
alter table public.customer_communications enable row level security;
alter table public.customer_communication_notes enable row level security;
alter table public.customer_communication_calls enable row level security;
alter table public.customer_communication_emails enable row level security;
alter table public.customer_communication_attachments enable row level security;

create policy "Users can view their business communications"
  on public.customer_communications
  for select
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = customer_communications.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

create policy "Users can insert communications for their business"
  on public.customer_communications
  for insert
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = customer_communications.business_profile_id
        and bp.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.customers c
      where c.id = customer_communications.customer_id
        and c.business_profile_id = customer_communications.business_profile_id
    )
  );

create policy "Users can update their business communications"
  on public.customer_communications
  for update
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = customer_communications.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

create policy "Users can delete their business communications"
  on public.customer_communications
  for delete
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = customer_communications.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

-- Child table policies (scoped via parent communication)
create policy "Users can view communication notes"
  on public.customer_communication_notes
  for select
  using (
    exists (
      select 1
      from public.customer_communications cc
      join public.business_profiles bp on bp.id = cc.business_profile_id
      where cc.id = customer_communication_notes.communication_id
        and bp.user_id = auth.uid()
    )
  );

create policy "Users can insert communication notes"
  on public.customer_communication_notes
  for insert
  with check (
    exists (
      select 1
      from public.customer_communications cc
      join public.business_profiles bp on bp.id = cc.business_profile_id
      where cc.id = customer_communication_notes.communication_id
        and bp.user_id = auth.uid()
    )
  );

create policy "Users can view communication calls"
  on public.customer_communication_calls
  for select
  using (
    exists (
      select 1
      from public.customer_communications cc
      join public.business_profiles bp on bp.id = cc.business_profile_id
      where cc.id = customer_communication_calls.communication_id
        and bp.user_id = auth.uid()
    )
  );

create policy "Users can insert communication calls"
  on public.customer_communication_calls
  for insert
  with check (
    exists (
      select 1
      from public.customer_communications cc
      join public.business_profiles bp on bp.id = cc.business_profile_id
      where cc.id = customer_communication_calls.communication_id
        and bp.user_id = auth.uid()
    )
  );

create policy "Users can view communication emails"
  on public.customer_communication_emails
  for select
  using (
    exists (
      select 1
      from public.customer_communications cc
      join public.business_profiles bp on bp.id = cc.business_profile_id
      where cc.id = customer_communication_emails.communication_id
        and bp.user_id = auth.uid()
    )
  );

create policy "Users can insert communication emails"
  on public.customer_communication_emails
  for insert
  with check (
    exists (
      select 1
      from public.customer_communications cc
      join public.business_profiles bp on bp.id = cc.business_profile_id
      where cc.id = customer_communication_emails.communication_id
        and bp.user_id = auth.uid()
    )
  );

create policy "Users can update communication emails"
  on public.customer_communication_emails
  for update
  using (
    exists (
      select 1
      from public.customer_communications cc
      join public.business_profiles bp on bp.id = cc.business_profile_id
      where cc.id = customer_communication_emails.communication_id
        and bp.user_id = auth.uid()
    )
  );

create policy "Users can view communication attachments"
  on public.customer_communication_attachments
  for select
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = customer_communication_attachments.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

create policy "Users can insert communication attachments"
  on public.customer_communication_attachments
  for insert
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = customer_communication_attachments.business_profile_id
        and bp.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.customers c
      where c.id = customer_communication_attachments.customer_id
        and c.business_profile_id = customer_communication_attachments.business_profile_id
    )
  );

create policy "Users can delete communication attachments"
  on public.customer_communication_attachments
  for delete
  using (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = customer_communication_attachments.business_profile_id
        and bp.user_id = auth.uid()
    )
  );

-- Supabase Storage bucket for attachments
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'communication-attachments',
  'communication-attachments',
  false,
  26214400,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ]
)
on conflict (id) do nothing;

create policy "Users can upload communication attachments"
  on storage.objects
  for insert
  with check (
    bucket_id = 'communication-attachments'
    and auth.uid() is not null
    and (storage.foldername(name))[1] in (
      select bp.id::text
      from public.business_profiles bp
      where bp.user_id = auth.uid()
    )
  );

create policy "Users can view their communication attachments"
  on storage.objects
  for select
  using (
    bucket_id = 'communication-attachments'
    and auth.uid() is not null
    and (storage.foldername(name))[1] in (
      select bp.id::text
      from public.business_profiles bp
      where bp.user_id = auth.uid()
    )
  );

create policy "Users can delete their communication attachments"
  on storage.objects
  for delete
  using (
    bucket_id = 'communication-attachments'
    and auth.uid() is not null
    and (storage.foldername(name))[1] in (
      select bp.id::text
      from public.business_profiles bp
      where bp.user_id = auth.uid()
    )
  );
