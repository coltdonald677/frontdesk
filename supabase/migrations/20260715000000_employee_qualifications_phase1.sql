-- Employee Qualifications, Certifications, and Training (additive, idempotent)
-- Review and apply manually in Supabase SQL editor.
-- Extends employees architecture with skills, certifications, training, and job requirements.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'certification_status' and n.nspname = 'public'
  ) then
    create type public.certification_status as enum (
      'valid',
      'expiring_soon',
      'expired',
      'pending_verification',
      'suspended',
      'revoked'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'certification_verification_status' and n.nspname = 'public'
  ) then
    create type public.certification_verification_status as enum (
      'unverified',
      'verified',
      'rejected'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'certification_type' and n.nspname = 'public'
  ) then
    create type public.certification_type as enum (
      'licence',
      'certification',
      'endorsement',
      'medical',
      'orientation',
      'other'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'proficiency_level' and n.nspname = 'public'
  ) then
    create type public.proficiency_level as enum (
      'beginner',
      'intermediate',
      'advanced',
      'expert'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'training_result' and n.nspname = 'public'
  ) then
    create type public.training_result as enum (
      'passed',
      'failed',
      'incomplete'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'requirement_severity' and n.nspname = 'public'
  ) then
    create type public.requirement_severity as enum (
      'blocking',
      'warning',
      'informational'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'requirement_item_type' and n.nspname = 'public'
  ) then
    create type public.requirement_item_type as enum (
      'certification',
      'skill',
      'training'
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- business_skills (tenant skill catalog)
-- ---------------------------------------------------------------------------

create table if not exists public.business_skills (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists business_skills_business_name_idx
  on public.business_skills (business_profile_id, lower(trim(name)));

create index if not exists business_skills_business_profile_id_idx
  on public.business_skills (business_profile_id);

-- ---------------------------------------------------------------------------
-- employee_skills
-- ---------------------------------------------------------------------------

create table if not exists public.employee_skills (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  skill_id uuid not null references public.business_skills (id) on delete cascade,
  proficiency_level public.proficiency_level not null default 'intermediate',
  verified boolean not null default false,
  verified_by text,
  verified_at timestamptz,
  years_experience numeric(4, 1),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, skill_id)
);

create index if not exists employee_skills_employee_id_idx
  on public.employee_skills (employee_id);

create index if not exists employee_skills_business_profile_id_idx
  on public.employee_skills (business_profile_id);

-- ---------------------------------------------------------------------------
-- employee_certifications
-- ---------------------------------------------------------------------------

create table if not exists public.employee_certifications (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  name text not null,
  certification_type public.certification_type not null default 'certification',
  issuing_organization text,
  certificate_number text,
  issue_date date,
  expiry_date date,
  does_not_expire boolean not null default false,
  status public.certification_status not null default 'pending_verification',
  notes text,
  verification_status public.certification_verification_status not null default 'unverified',
  verified_by text,
  verified_at timestamptz,
  reminder_days integer[] not null default '{90,60,30,7,0}'::integer[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_certifications_employee_id_idx
  on public.employee_certifications (employee_id);

create index if not exists employee_certifications_business_profile_id_idx
  on public.employee_certifications (business_profile_id);

create index if not exists employee_certifications_expiry_idx
  on public.employee_certifications (business_profile_id, expiry_date)
  where does_not_expire = false and expiry_date is not null;

-- ---------------------------------------------------------------------------
-- employee_training_records
-- ---------------------------------------------------------------------------

create table if not exists public.employee_training_records (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  course_name text not null,
  provider text,
  completion_date date,
  expiry_date date,
  result public.training_result not null default 'incomplete',
  score text,
  instructor text,
  training_hours numeric(6, 2),
  refresher_interval_days integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_training_records_employee_id_idx
  on public.employee_training_records (employee_id);

create index if not exists employee_training_records_business_profile_id_idx
  on public.employee_training_records (business_profile_id);

-- ---------------------------------------------------------------------------
-- qualification_requirements + items
-- ---------------------------------------------------------------------------

create table if not exists public.qualification_requirements (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  name text not null,
  description text,
  applies_to_entry_types text[] not null default '{}'::text[],
  min_qualified_employees integer not null default 1,
  valid_through_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists qualification_requirements_business_profile_id_idx
  on public.qualification_requirements (business_profile_id);

create table if not exists public.qualification_requirement_items (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.qualification_requirements (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  item_type public.requirement_item_type not null,
  certification_name text,
  skill_id uuid references public.business_skills (id) on delete set null,
  training_course_name text,
  minimum_proficiency public.proficiency_level,
  severity public.requirement_severity not null default 'warning',
  created_at timestamptz not null default now()
);

create index if not exists qualification_requirement_items_requirement_id_idx
  on public.qualification_requirement_items (requirement_id);

-- ---------------------------------------------------------------------------
-- manager overrides for blocking requirements
-- ---------------------------------------------------------------------------

create table if not exists public.employee_requirement_overrides (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  requirement_id uuid references public.qualification_requirements (id) on delete set null,
  requirement_item_id uuid references public.qualification_requirement_items (id) on delete set null,
  reason text not null,
  overridden_by_name text,
  assignment_start_date date,
  assignment_end_date date,
  created_at timestamptz not null default now()
);

create index if not exists employee_requirement_overrides_employee_id_idx
  on public.employee_requirement_overrides (employee_id);

-- ---------------------------------------------------------------------------
-- qualification documents (metadata; files in private storage)
-- ---------------------------------------------------------------------------

create table if not exists public.employee_qualification_documents (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  certification_id uuid references public.employee_certifications (id) on delete cascade,
  training_record_id uuid references public.employee_training_records (id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text not null,
  file_size integer not null,
  created_at timestamptz not null default now()
);

create index if not exists employee_qualification_documents_employee_id_idx
  on public.employee_qualification_documents (employee_id);

create table if not exists public.qualification_document_audit (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  document_id uuid references public.employee_qualification_documents (id) on delete set null,
  action text not null check (action in ('upload', 'delete', 'download')),
  actor_user_id uuid,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create or replace function public.handle_qualification_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists business_skills_updated_at on public.business_skills;
create trigger business_skills_updated_at
  before update on public.business_skills
  for each row execute function public.handle_qualification_updated_at();

drop trigger if exists employee_skills_updated_at on public.employee_skills;
create trigger employee_skills_updated_at
  before update on public.employee_skills
  for each row execute function public.handle_qualification_updated_at();

drop trigger if exists employee_certifications_updated_at on public.employee_certifications;
create trigger employee_certifications_updated_at
  before update on public.employee_certifications
  for each row execute function public.handle_qualification_updated_at();

drop trigger if exists employee_training_records_updated_at on public.employee_training_records;
create trigger employee_training_records_updated_at
  before update on public.employee_training_records
  for each row execute function public.handle_qualification_updated_at();

drop trigger if exists qualification_requirements_updated_at on public.qualification_requirements;
create trigger qualification_requirements_updated_at
  before update on public.qualification_requirements
  for each row execute function public.handle_qualification_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.business_skills enable row level security;
alter table public.employee_skills enable row level security;
alter table public.employee_certifications enable row level security;
alter table public.employee_training_records enable row level security;
alter table public.qualification_requirements enable row level security;
alter table public.qualification_requirement_items enable row level security;
alter table public.employee_requirement_overrides enable row level security;
alter table public.employee_qualification_documents enable row level security;
alter table public.qualification_document_audit enable row level security;

-- business_skills
drop policy if exists "Users can view their business skills" on public.business_skills;
create policy "Users can view their business skills"
  on public.business_skills for select
  using (exists (
    select 1 from public.business_profiles bp
    where bp.id = business_skills.business_profile_id and bp.user_id = auth.uid()
  ));

drop policy if exists "Users can insert business skills" on public.business_skills;
create policy "Users can insert business skills"
  on public.business_skills for insert
  with check (exists (
    select 1 from public.business_profiles bp
    where bp.id = business_skills.business_profile_id and bp.user_id = auth.uid()
  ));

drop policy if exists "Users can update their business skills" on public.business_skills;
create policy "Users can update their business skills"
  on public.business_skills for update
  using (exists (
    select 1 from public.business_profiles bp
    where bp.id = business_skills.business_profile_id and bp.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.business_profiles bp
    where bp.id = business_skills.business_profile_id and bp.user_id = auth.uid()
  ));

drop policy if exists "Users can delete their business skills" on public.business_skills;
create policy "Users can delete their business skills"
  on public.business_skills for delete
  using (exists (
    select 1 from public.business_profiles bp
    where bp.id = business_skills.business_profile_id and bp.user_id = auth.uid()
  ));

-- employee_skills (employee ownership enforced)
drop policy if exists "Users can view employee skills for their business" on public.employee_skills;
create policy "Users can view employee skills for their business"
  on public.employee_skills for select
  using (exists (
    select 1 from public.business_profiles bp
    where bp.id = employee_skills.business_profile_id and bp.user_id = auth.uid()
  ));

drop policy if exists "Users can insert employee skills for their business" on public.employee_skills;
create policy "Users can insert employee skills for their business"
  on public.employee_skills for insert
  with check (
    exists (
      select 1 from public.business_profiles bp
      where bp.id = employee_skills.business_profile_id and bp.user_id = auth.uid()
    )
    and exists (
      select 1 from public.employees e
      where e.id = employee_skills.employee_id
        and e.business_profile_id = employee_skills.business_profile_id
    )
    and exists (
      select 1 from public.business_skills bs
      where bs.id = employee_skills.skill_id
        and bs.business_profile_id = employee_skills.business_profile_id
    )
  );

drop policy if exists "Users can update employee skills for their business" on public.employee_skills;
create policy "Users can update employee skills for their business"
  on public.employee_skills for update
  using (exists (
    select 1 from public.business_profiles bp
    where bp.id = employee_skills.business_profile_id and bp.user_id = auth.uid()
  ))
  with check (
    exists (
      select 1 from public.business_profiles bp
      where bp.id = employee_skills.business_profile_id and bp.user_id = auth.uid()
    )
    and exists (
      select 1 from public.employees e
      where e.id = employee_skills.employee_id
        and e.business_profile_id = employee_skills.business_profile_id
    )
    and exists (
      select 1 from public.business_skills bs
      where bs.id = employee_skills.skill_id
        and bs.business_profile_id = employee_skills.business_profile_id
    )
  );

drop policy if exists "Users can delete employee skills for their business" on public.employee_skills;
create policy "Users can delete employee skills for their business"
  on public.employee_skills for delete
  using (exists (
    select 1 from public.business_profiles bp
    where bp.id = employee_skills.business_profile_id and bp.user_id = auth.uid()
  ));

-- employee_certifications
drop policy if exists "Users can view employee certifications" on public.employee_certifications;
create policy "Users can view employee certifications"
  on public.employee_certifications for select
  using (exists (
    select 1 from public.business_profiles bp
    where bp.id = employee_certifications.business_profile_id and bp.user_id = auth.uid()
  ));

drop policy if exists "Users can insert employee certifications" on public.employee_certifications;
create policy "Users can insert employee certifications"
  on public.employee_certifications for insert
  with check (
    exists (
      select 1 from public.business_profiles bp
      where bp.id = employee_certifications.business_profile_id and bp.user_id = auth.uid()
    )
    and exists (
      select 1 from public.employees e
      where e.id = employee_certifications.employee_id
        and e.business_profile_id = employee_certifications.business_profile_id
    )
  );

drop policy if exists "Users can update employee certifications" on public.employee_certifications;
create policy "Users can update employee certifications"
  on public.employee_certifications for update
  using (exists (
    select 1 from public.business_profiles bp
    where bp.id = employee_certifications.business_profile_id and bp.user_id = auth.uid()
  ))
  with check (
    exists (
      select 1 from public.business_profiles bp
      where bp.id = employee_certifications.business_profile_id and bp.user_id = auth.uid()
    )
    and exists (
      select 1 from public.employees e
      where e.id = employee_certifications.employee_id
        and e.business_profile_id = employee_certifications.business_profile_id
    )
  );

drop policy if exists "Users can delete employee certifications" on public.employee_certifications;
create policy "Users can delete employee certifications"
  on public.employee_certifications for delete
  using (exists (
    select 1 from public.business_profiles bp
    where bp.id = employee_certifications.business_profile_id and bp.user_id = auth.uid()
  ));

-- employee_training_records (same employee ownership pattern)
drop policy if exists "Users can view employee training records" on public.employee_training_records;
create policy "Users can view employee training records"
  on public.employee_training_records for select
  using (exists (
    select 1 from public.business_profiles bp
    where bp.id = employee_training_records.business_profile_id and bp.user_id = auth.uid()
  ));

drop policy if exists "Users can insert employee training records" on public.employee_training_records;
create policy "Users can insert employee training records"
  on public.employee_training_records for insert
  with check (
    exists (
      select 1 from public.business_profiles bp
      where bp.id = employee_training_records.business_profile_id and bp.user_id = auth.uid()
    )
    and exists (
      select 1 from public.employees e
      where e.id = employee_training_records.employee_id
        and e.business_profile_id = employee_training_records.business_profile_id
    )
  );

drop policy if exists "Users can update employee training records" on public.employee_training_records;
create policy "Users can update employee training records"
  on public.employee_training_records for update
  using (exists (
    select 1 from public.business_profiles bp
    where bp.id = employee_training_records.business_profile_id and bp.user_id = auth.uid()
  ))
  with check (
    exists (
      select 1 from public.business_profiles bp
      where bp.id = employee_training_records.business_profile_id and bp.user_id = auth.uid()
    )
    and exists (
      select 1 from public.employees e
      where e.id = employee_training_records.employee_id
        and e.business_profile_id = employee_training_records.business_profile_id
    )
  );

drop policy if exists "Users can delete employee training records" on public.employee_training_records;
create policy "Users can delete employee training records"
  on public.employee_training_records for delete
  using (exists (
    select 1 from public.business_profiles bp
    where bp.id = employee_training_records.business_profile_id and bp.user_id = auth.uid()
  ));

-- qualification_requirements
drop policy if exists "Users can view qualification requirements" on public.qualification_requirements;
create policy "Users can view qualification requirements"
  on public.qualification_requirements for select
  using (exists (
    select 1 from public.business_profiles bp
    where bp.id = qualification_requirements.business_profile_id and bp.user_id = auth.uid()
  ));

drop policy if exists "Users can insert qualification requirements" on public.qualification_requirements;
create policy "Users can insert qualification requirements"
  on public.qualification_requirements for insert
  with check (exists (
    select 1 from public.business_profiles bp
    where bp.id = qualification_requirements.business_profile_id and bp.user_id = auth.uid()
  ));

drop policy if exists "Users can update qualification requirements" on public.qualification_requirements;
create policy "Users can update qualification requirements"
  on public.qualification_requirements for update
  using (exists (
    select 1 from public.business_profiles bp
    where bp.id = qualification_requirements.business_profile_id and bp.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.business_profiles bp
    where bp.id = qualification_requirements.business_profile_id and bp.user_id = auth.uid()
  ));

drop policy if exists "Users can delete qualification requirements" on public.qualification_requirements;
create policy "Users can delete qualification requirements"
  on public.qualification_requirements for delete
  using (exists (
    select 1 from public.business_profiles bp
    where bp.id = qualification_requirements.business_profile_id and bp.user_id = auth.uid()
  ));

-- qualification_requirement_items
drop policy if exists "Users can view qualification requirement items" on public.qualification_requirement_items;
create policy "Users can view qualification requirement items"
  on public.qualification_requirement_items for select
  using (exists (
    select 1 from public.business_profiles bp
    where bp.id = qualification_requirement_items.business_profile_id and bp.user_id = auth.uid()
  ));

drop policy if exists "Users can insert qualification requirement items" on public.qualification_requirement_items;
create policy "Users can insert qualification requirement items"
  on public.qualification_requirement_items for insert
  with check (
    exists (
      select 1 from public.business_profiles bp
      where bp.id = qualification_requirement_items.business_profile_id and bp.user_id = auth.uid()
    )
    and exists (
      select 1 from public.qualification_requirements qr
      where qr.id = qualification_requirement_items.requirement_id
        and qr.business_profile_id = qualification_requirement_items.business_profile_id
    )
    and (
      qualification_requirement_items.skill_id is null
      or exists (
        select 1 from public.business_skills bs
        where bs.id = qualification_requirement_items.skill_id
          and bs.business_profile_id = qualification_requirement_items.business_profile_id
      )
    )
  );

drop policy if exists "Users can update qualification requirement items" on public.qualification_requirement_items;
create policy "Users can update qualification requirement items"
  on public.qualification_requirement_items for update
  using (exists (
    select 1 from public.business_profiles bp
    where bp.id = qualification_requirement_items.business_profile_id and bp.user_id = auth.uid()
  ))
  with check (
    exists (
      select 1 from public.business_profiles bp
      where bp.id = qualification_requirement_items.business_profile_id and bp.user_id = auth.uid()
    )
    and exists (
      select 1 from public.qualification_requirements qr
      where qr.id = qualification_requirement_items.requirement_id
        and qr.business_profile_id = qualification_requirement_items.business_profile_id
    )
  );

drop policy if exists "Users can delete qualification requirement items" on public.qualification_requirement_items;
create policy "Users can delete qualification requirement items"
  on public.qualification_requirement_items for delete
  using (exists (
    select 1 from public.business_profiles bp
    where bp.id = qualification_requirement_items.business_profile_id and bp.user_id = auth.uid()
  ));

-- employee_requirement_overrides
drop policy if exists "Users can view requirement overrides" on public.employee_requirement_overrides;
create policy "Users can view requirement overrides"
  on public.employee_requirement_overrides for select
  using (exists (
    select 1 from public.business_profiles bp
    where bp.id = employee_requirement_overrides.business_profile_id and bp.user_id = auth.uid()
  ));

drop policy if exists "Users can insert requirement overrides" on public.employee_requirement_overrides;
create policy "Users can insert requirement overrides"
  on public.employee_requirement_overrides for insert
  with check (
    exists (
      select 1 from public.business_profiles bp
      where bp.id = employee_requirement_overrides.business_profile_id and bp.user_id = auth.uid()
    )
    and exists (
      select 1 from public.employees e
      where e.id = employee_requirement_overrides.employee_id
        and e.business_profile_id = employee_requirement_overrides.business_profile_id
    )
  );

-- employee_qualification_documents
drop policy if exists "Users can view qualification documents" on public.employee_qualification_documents;
create policy "Users can view qualification documents"
  on public.employee_qualification_documents for select
  using (exists (
    select 1 from public.business_profiles bp
    where bp.id = employee_qualification_documents.business_profile_id and bp.user_id = auth.uid()
  ));

drop policy if exists "Users can insert qualification documents" on public.employee_qualification_documents;
create policy "Users can insert qualification documents"
  on public.employee_qualification_documents for insert
  with check (
    exists (
      select 1 from public.business_profiles bp
      where bp.id = employee_qualification_documents.business_profile_id and bp.user_id = auth.uid()
    )
    and exists (
      select 1 from public.employees e
      where e.id = employee_qualification_documents.employee_id
        and e.business_profile_id = employee_qualification_documents.business_profile_id
    )
  );

drop policy if exists "Users can delete qualification documents" on public.employee_qualification_documents;
create policy "Users can delete qualification documents"
  on public.employee_qualification_documents for delete
  using (exists (
    select 1 from public.business_profiles bp
    where bp.id = employee_qualification_documents.business_profile_id and bp.user_id = auth.uid()
  ));

-- qualification_document_audit (read-only for users)
drop policy if exists "Users can view qualification document audit" on public.qualification_document_audit;
create policy "Users can view qualification document audit"
  on public.qualification_document_audit for select
  using (exists (
    select 1 from public.business_profiles bp
    where bp.id = qualification_document_audit.business_profile_id and bp.user_id = auth.uid()
  ));

drop policy if exists "Users can insert qualification document audit" on public.qualification_document_audit;
create policy "Users can insert qualification document audit"
  on public.qualification_document_audit for insert
  with check (exists (
    select 1 from public.business_profiles bp
    where bp.id = qualification_document_audit.business_profile_id and bp.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- Storage bucket (private, tenant-scoped paths)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee-qualification-documents',
  'employee-qualification-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "Qualification docs read own business folder" on storage.objects;
create policy "Qualification docs read own business folder"
  on storage.objects for select
  using (
    bucket_id = 'employee-qualification-documents'
    and exists (
      select 1 from public.business_profiles bp
      where bp.id = (storage.foldername(name))[1]::uuid
        and bp.user_id = auth.uid()
    )
  );

drop policy if exists "Qualification docs insert own business folder" on storage.objects;
create policy "Qualification docs insert own business folder"
  on storage.objects for insert
  with check (
    bucket_id = 'employee-qualification-documents'
    and exists (
      select 1 from public.business_profiles bp
      where bp.id = (storage.foldername(name))[1]::uuid
        and bp.user_id = auth.uid()
    )
  );

drop policy if exists "Qualification docs delete own business folder" on storage.objects;
create policy "Qualification docs delete own business folder"
  on storage.objects for delete
  using (
    bucket_id = 'employee-qualification-documents'
    and exists (
      select 1 from public.business_profiles bp
      where bp.id = (storage.foldername(name))[1]::uuid
        and bp.user_id = auth.uid()
    )
  );
