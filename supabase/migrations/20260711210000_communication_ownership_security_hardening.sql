-- Pluto Security Hardening Phase 2B follow-up (F-007, F-008)
-- Additive only: tightens RLS for communication attachments and employee FK on communications.
-- Review and apply manually in Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- F-007: Attachment INSERT must validate communication_id ownership when set
-- ---------------------------------------------------------------------------
-- Previous INSERT policy verified business_profile_id and customer_id only.
-- Vulnerability: communication_id could reference another customer's communication.

drop policy if exists "Users can insert communication attachments"
  on public.customer_communication_attachments;

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
    and (
      customer_communication_attachments.communication_id is null
      or exists (
        select 1
        from public.customer_communications cc
        where cc.id = customer_communication_attachments.communication_id
          and cc.customer_id = customer_communication_attachments.customer_id
          and cc.business_profile_id = customer_communication_attachments.business_profile_id
      )
    )
  );

-- ---------------------------------------------------------------------------
-- F-008: Communications INSERT/UPDATE must validate employee_id ownership
-- ---------------------------------------------------------------------------
-- Previous policies did not verify employee_id belongs to business_profile_id.

drop policy if exists "Users can insert communications for their business"
  on public.customer_communications;

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
    and (
      customer_communications.employee_id is null
      or exists (
        select 1
        from public.employees e
        where e.id = customer_communications.employee_id
          and e.business_profile_id = customer_communications.business_profile_id
      )
    )
  );

drop policy if exists "Users can update their business communications"
  on public.customer_communications;

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
  )
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
    and (
      customer_communications.employee_id is null
      or exists (
        select 1
        from public.employees e
        where e.id = customer_communications.employee_id
          and e.business_profile_id = customer_communications.business_profile_id
      )
    )
  );
