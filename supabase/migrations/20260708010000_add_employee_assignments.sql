-- Assign employees to appointments and tasks (non-destructive)
-- Adds nullable employee_id columns, indexes, and extends existing RLS policies.
-- Does not drop tables, delete rows, or remove policies.

alter table public.appointments
  add column if not exists employee_id uuid
    references public.employees (id) on delete set null;

alter table public.tasks
  add column if not exists employee_id uuid
    references public.employees (id) on delete set null;

create index if not exists appointments_employee_id_idx
  on public.appointments (employee_id);

create index if not exists tasks_employee_id_idx
  on public.tasks (employee_id);

create index if not exists appointments_employee_date_idx
  on public.appointments (employee_id, appointment_date)
  where status = 'scheduled';

-- Extend existing policies to validate employee ownership (no DROP required)

alter policy "Users can insert appointments for their business"
  on public.appointments
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = appointments.business_profile_id
        and bp.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.customers c
      where c.id = appointments.customer_id
        and c.business_profile_id = appointments.business_profile_id
    )
    and (
      appointments.employee_id is null
      or exists (
        select 1
        from public.employees e
        where e.id = appointments.employee_id
          and e.business_profile_id = appointments.business_profile_id
      )
    )
  );

alter policy "Users can update their business appointments"
  on public.appointments
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = appointments.business_profile_id
        and bp.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.customers c
      where c.id = appointments.customer_id
        and c.business_profile_id = appointments.business_profile_id
    )
    and (
      appointments.employee_id is null
      or exists (
        select 1
        from public.employees e
        where e.id = appointments.employee_id
          and e.business_profile_id = appointments.business_profile_id
      )
    )
  );

alter policy "Users can insert tasks for their business"
  on public.tasks
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = tasks.business_profile_id
        and bp.user_id = auth.uid()
    )
    and (
      tasks.customer_id is null
      or exists (
        select 1
        from public.customers c
        where c.id = tasks.customer_id
          and c.business_profile_id = tasks.business_profile_id
      )
    )
    and (
      tasks.employee_id is null
      or exists (
        select 1
        from public.employees e
        where e.id = tasks.employee_id
          and e.business_profile_id = tasks.business_profile_id
      )
    )
  );

alter policy "Users can update their business tasks"
  on public.tasks
  with check (
    exists (
      select 1
      from public.business_profiles bp
      where bp.id = tasks.business_profile_id
        and bp.user_id = auth.uid()
    )
    and (
      tasks.customer_id is null
      or exists (
        select 1
        from public.customers c
        where c.id = tasks.customer_id
          and c.business_profile_id = tasks.business_profile_id
      )
    )
    and (
      tasks.employee_id is null
      or exists (
        select 1
        from public.employees e
        where e.id = tasks.employee_id
          and e.business_profile_id = tasks.business_profile_id
      )
    )
  );
