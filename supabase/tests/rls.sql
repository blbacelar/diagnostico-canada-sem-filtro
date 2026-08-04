-- Executar com: npx supabase test db supabase/tests/rls.sql --local
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname like 'diagnostic_%'
      and c.relkind = 'r'
      and not c.relrowsecurity
  ),
  0,
  'todas as tabelas diagnostic_ têm RLS habilitada'
);

select is(
  (
    select count(*)::integer
    from information_schema.table_privileges
    where grantee = 'anon'
      and table_schema = 'public'
      and table_name like 'diagnostic_%'
  ),
  0,
  'anon não possui privilégios diretos nas tabelas diagnostic_'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename like 'diagnostic_%'
      and 'anon' = any(roles)
  ),
  0,
  'nenhuma policy diagnostic_ concede acesso à role anon'
);

select is(
  (
    select count(*)::integer
    from pg_trigger
    where tgname = 'diagnostic_submissions_immutable'
      and not tgisinternal
  ),
  1,
  'snapshot de submissão possui trigger de imutabilidade'
);

select is(
  (
    select count(*)::integer
    from pg_trigger
    where tgname = 'diagnostic_audit_logs_immutable'
      and not tgisinternal
  ),
  1,
  'logs de auditoria possuem trigger de imutabilidade'
);

select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('diagnostic_is_consultant', 'diagnostic_is_admin')
  ),
  0,
  'funções privilegiadas não ficam expostas no schema public'
);

select is(
  (
    select count(*)::integer
    from information_schema.table_privileges
    where grantee = 'authenticated'
      and table_schema = 'public'
      and table_name = 'diagnostic_operational_settings'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  ),
  0,
  'parâmetros operacionais não podem ser alterados diretamente pelo cliente autenticado'
);

select is(
  (
    select count(*)::integer
    from information_schema.table_privileges
    where grantee = 'service_role'
      and table_schema = 'public'
      and table_name = 'diagnostic_operational_settings'
      and privilege_type in ('SELECT', 'UPDATE')
  ),
  2,
  'backend possui somente o acesso necessário para consultar e atualizar parâmetros'
);

select * from finish();
rollback;
