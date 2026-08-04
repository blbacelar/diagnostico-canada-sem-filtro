-- Explicitly deny authenticated access to internal backend-only tables.
-- Service role keeps full access via GRANTs and bypasses RLS.

alter table public.diagnostic_access_tokens enable row level security;
alter table public.diagnostic_rate_limits enable row level security;
alter table public.diagnostic_report_tokens enable row level security;
alter table public.diagnostic_operational_settings enable row level security;

drop policy if exists diagnostic_access_tokens_deny_all on public.diagnostic_access_tokens;
create policy diagnostic_access_tokens_deny_all
on public.diagnostic_access_tokens
for all
to authenticated
using (false)
with check (false);

drop policy if exists diagnostic_rate_limits_deny_all on public.diagnostic_rate_limits;
create policy diagnostic_rate_limits_deny_all
on public.diagnostic_rate_limits
for all
to authenticated
using (false)
with check (false);

drop policy if exists diagnostic_report_tokens_deny_all on public.diagnostic_report_tokens;
create policy diagnostic_report_tokens_deny_all
on public.diagnostic_report_tokens
for all
to authenticated
using (false)
with check (false);

drop policy if exists diagnostic_operational_settings_deny_all on public.diagnostic_operational_settings;
create policy diagnostic_operational_settings_deny_all
on public.diagnostic_operational_settings
for all
to authenticated
using (false)
with check (false);
