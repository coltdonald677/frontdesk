-- Automation settings and in-app notifications (jsonb on business_profiles)
alter table public.business_profiles
  add column if not exists automation_settings jsonb not null default '{}'::jsonb;
