create table if not exists public.diagnostic_operational_settings (
  id smallint primary key default 1 check (id = 1),
  policy_version text not null check (char_length(policy_version) between 1 and 40),
  methodology_version text not null check (char_length(methodology_version) between 1 and 40),
  prompt_version text not null check (char_length(prompt_version) between 1 and 40),
  model text not null check (char_length(model) between 3 and 200),
  form_link_days smallint not null check (form_link_days between 1 and 90),
  report_link_days smallint not null check (report_link_days between 1 and 365),
  review_sla_hours smallint not null check (review_sla_hours between 1 and 720),
  revision integer not null default 1 check (revision > 0),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.diagnostic_operational_settings enable row level security;
revoke all on public.diagnostic_operational_settings from public, anon, authenticated;
grant all on public.diagnostic_operational_settings to service_role;

create or replace function diagnostic_private.diagnostic_touch_operational_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.revision = old.revision + 1;
  return new;
end;
$$;

drop trigger if exists diagnostic_operational_settings_touch on public.diagnostic_operational_settings;
create trigger diagnostic_operational_settings_touch
before update on public.diagnostic_operational_settings
for each row execute function diagnostic_private.diagnostic_touch_operational_settings();

insert into public.diagnostic_operational_settings (
  id,
  policy_version,
  methodology_version,
  prompt_version,
  model,
  form_link_days,
  report_link_days,
  review_sla_hours
)
values (
  1,
  '2026-08-03',
  '1.0.0',
  '2026-08-03',
  'openai/gpt-5.6-terra',
  14,
  30,
  48
)
on conflict (id) do nothing;

alter table public.diagnostic_ai_assessments
  add column if not exists prompt_version text not null default '2026-08-03';
