-- Impede que uma consultora leia ou altere dados de um caso ativo reservado por outra.
-- O backend usa service_role e aplica também uma aquisição atômica antes de devolver os dados.

create or replace function diagnostic_private.diagnostic_can_access_case(target_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select diagnostic_private.diagnostic_is_consultant())
    and exists (
      select 1
      from public.diagnostic_cases as diagnostic_case
      where diagnostic_case.id = target_case_id
        and (
          diagnostic_case.status in ('sent', 'archived')
          or diagnostic_case.assigned_consultant_id is null
          or diagnostic_case.assigned_consultant_id = (select auth.uid())
        )
    );
$$;

revoke all on function diagnostic_private.diagnostic_can_access_case(uuid) from public;
grant execute on function diagnostic_private.diagnostic_can_access_case(uuid) to authenticated;

drop policy if exists diagnostic_cases_consultant_select on public.diagnostic_cases;
create policy diagnostic_cases_consultant_select on public.diagnostic_cases
for select to authenticated
using ((select diagnostic_private.diagnostic_can_access_case(id)));

drop policy if exists diagnostic_clients_consultant_select on public.diagnostic_clients;
create policy diagnostic_clients_consultant_select on public.diagnostic_clients
for select to authenticated
using (exists (
  select 1
  from public.diagnostic_cases as diagnostic_case
  where diagnostic_case.client_id = diagnostic_clients.id
    and (select diagnostic_private.diagnostic_can_access_case(diagnostic_case.id))
));

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'diagnostic_answers',
    'diagnostic_consents',
    'diagnostic_submissions',
    'diagnostic_ai_assessments',
    'diagnostic_reviews',
    'diagnostic_review_versions',
    'diagnostic_email_deliveries',
    'diagnostic_status_history'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_consultant_select', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select diagnostic_private.diagnostic_can_access_case(case_id)))',
      table_name || '_consultant_select',
      table_name
    );
  end loop;
end $$;

drop policy if exists diagnostic_audit_logs_consultant_select on public.diagnostic_audit_logs;
create policy diagnostic_audit_logs_consultant_select on public.diagnostic_audit_logs
for select to authenticated
using (case_id is null or (select diagnostic_private.diagnostic_can_access_case(case_id)));

drop policy if exists diagnostic_reviews_consultant_insert on public.diagnostic_reviews;
create policy diagnostic_reviews_consultant_insert on public.diagnostic_reviews
for insert to authenticated
with check (
  (select diagnostic_private.diagnostic_is_consultant())
  and consultant_id = (select auth.uid())
  and (select diagnostic_private.diagnostic_can_access_case(case_id))
);

drop policy if exists diagnostic_reviews_consultant_update on public.diagnostic_reviews;
create policy diagnostic_reviews_consultant_update on public.diagnostic_reviews
for update to authenticated
using (
  (select diagnostic_private.diagnostic_is_consultant())
  and consultant_id = (select auth.uid())
  and (select diagnostic_private.diagnostic_can_access_case(case_id))
)
with check (
  (select diagnostic_private.diagnostic_is_consultant())
  and consultant_id = (select auth.uid())
  and (select diagnostic_private.diagnostic_can_access_case(case_id))
);
