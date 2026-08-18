-- Simulador Canadá Sem Filtro
-- Migration aditiva para o projeto Supabase compartilhado.
-- Não altera journals, allowed_emails ou qualquer objeto do Diário de Bordo.

create schema if not exists diagnostic_private;
revoke all on schema diagnostic_private from public, anon, authenticated;

create or replace function diagnostic_private.diagnostic_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.diagnostic_consultants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('consultant', 'admin')),
  active boolean not null default true,
  display_name text not null check (char_length(display_name) between 2 and 120),
  notification_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function diagnostic_private.diagnostic_is_consultant()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.diagnostic_consultants
    where user_id = (select auth.uid()) and active = true
  );
$$;

create or replace function diagnostic_private.diagnostic_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.diagnostic_consultants
    where user_id = (select auth.uid()) and active = true and role = 'admin'
  );
$$;

revoke all on function diagnostic_private.diagnostic_is_consultant() from public;
revoke all on function diagnostic_private.diagnostic_is_admin() from public;
grant usage on schema diagnostic_private to authenticated;
grant execute on function diagnostic_private.diagnostic_is_consultant() to authenticated;
grant execute on function diagnostic_private.diagnostic_is_admin() to authenticated;

create table if not exists public.diagnostic_clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 3 and 160),
  email_normalized text not null unique check (email_normalized = lower(trim(email_normalized))),
  email_display text not null,
  source text not null default 'hotmart',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists diagnostic_clients_email_normalized_idx on public.diagnostic_clients (email_normalized);

create table if not exists public.diagnostic_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique,
  client_id uuid not null references public.diagnostic_clients(id) on delete restrict,
  status text not null default 'client_draft' check (status in ('client_draft','submitted','ai_processing','awaiting_triage','in_review','awaiting_client','ready_for_approval','approved','sending','sent','processing_error','archived')),
  assigned_consultant_id uuid references public.diagnostic_consultants(user_id) on delete set null,
  objective text,
  source_metadata jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists diagnostic_cases_client_id_idx on public.diagnostic_cases (client_id);
create index if not exists diagnostic_cases_status_idx on public.diagnostic_cases (status, updated_at desc);
create index if not exists diagnostic_cases_assigned_idx on public.diagnostic_cases (assigned_consultant_id) where assigned_consultant_id is not null;
create unique index if not exists diagnostic_cases_one_active_per_client_idx
  on public.diagnostic_cases (client_id)
  where status in ('client_draft','submitted','ai_processing','awaiting_triage','in_review','awaiting_client','ready_for_approval','approved','sending');

create table if not exists public.diagnostic_access_tokens (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.diagnostic_cases(id) on delete cascade,
  token_hash text not null unique check (char_length(token_hash) = 64),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists diagnostic_access_tokens_case_idx on public.diagnostic_access_tokens (case_id, expires_at desc);

create table if not exists public.diagnostic_answers (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.diagnostic_cases(id) on delete cascade,
  section_key text not null,
  question_key text not null,
  answer jsonb not null,
  schema_version integer not null default 1 check (schema_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, question_key)
);
create index if not exists diagnostic_answers_case_section_idx on public.diagnostic_answers (case_id, section_key);

create table if not exists public.diagnostic_consents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.diagnostic_cases(id) on delete cascade,
  consent_type text not null,
  policy_version text not null,
  granted boolean not null,
  source text not null,
  created_at timestamptz not null default now()
);
create index if not exists diagnostic_consents_case_idx on public.diagnostic_consents (case_id, created_at desc);

create table if not exists public.diagnostic_submissions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.diagnostic_cases(id) on delete restrict,
  answers_snapshot jsonb not null,
  schema_version integer not null check (schema_version > 0),
  consent_snapshot jsonb not null,
  idempotency_key uuid not null,
  submitted_at timestamptz not null default now(),
  unique (case_id, idempotency_key)
);
create index if not exists diagnostic_submissions_case_idx on public.diagnostic_submissions (case_id, submitted_at desc);

create table if not exists public.diagnostic_ai_assessments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.diagnostic_cases(id) on delete restrict,
  submission_id uuid not null references public.diagnostic_submissions(id) on delete restrict,
  version integer not null check (version > 0),
  status text not null check (status in ('processing','completed','failed')),
  methodology_version text not null,
  model text not null,
  structured_result jsonb not null default '{}'::jsonb,
  confidence numeric check (confidence between 0 and 1),
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (case_id, version)
);
create index if not exists diagnostic_ai_assessments_case_idx on public.diagnostic_ai_assessments (case_id, version desc);

create table if not exists public.diagnostic_reviews (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.diagnostic_cases(id) on delete restrict,
  consultant_id uuid not null references public.diagnostic_consultants(user_id) on delete restrict,
  version integer not null check (version > 0),
  coherent_path text not null default '',
  assumptions_to_review text not null default '',
  likely_mistakes text not null default '',
  immediate_focus text not null default '',
  study_strategy text not null default '',
  validation_risks text not null default '',
  next_steps text[] not null default '{}'::text[],
  additional_notes text not null default '',
  recommended_resources text[] not null default '{}'::text[],
  status text not null default 'draft' check (status in ('draft','ready_for_approval','approved','superseded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.diagnostic_consultants(user_id) on delete set null,
  unique (case_id, version)
);
create index if not exists diagnostic_reviews_case_idx on public.diagnostic_reviews (case_id, version desc);

create table if not exists public.diagnostic_review_versions (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.diagnostic_reviews(id) on delete restrict,
  case_id uuid not null references public.diagnostic_cases(id) on delete restrict,
  version integer not null,
  snapshot jsonb not null,
  created_by uuid not null references public.diagnostic_consultants(user_id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists diagnostic_review_versions_review_idx on public.diagnostic_review_versions (review_id, created_at desc);

create table if not exists public.diagnostic_email_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  name text not null,
  subject text not null,
  body text not null,
  active boolean not null default true,
  version integer not null default 1,
  created_by uuid references public.diagnostic_consultants(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.diagnostic_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.diagnostic_cases(id) on delete restrict,
  delivery_type text not null,
  recipient text not null,
  subject text not null,
  body_snapshot text,
  status text not null check (status in ('pending','sending','sent','failed')),
  provider_id text,
  error_code text,
  sent_by uuid references public.diagnostic_consultants(user_id) on delete set null,
  idempotency_key uuid unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists diagnostic_email_deliveries_case_idx on public.diagnostic_email_deliveries (case_id, created_at desc);

create table if not exists public.diagnostic_content_recommendations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  url text,
  tags text[] not null default '{}'::text[],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.diagnostic_status_history (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.diagnostic_cases(id) on delete restrict,
  from_status text,
  to_status text not null,
  actor_type text not null check (actor_type in ('client','consultant','system')),
  actor_user_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists diagnostic_status_history_case_idx on public.diagnostic_status_history (case_id, created_at desc);

create table if not exists public.diagnostic_audit_logs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.diagnostic_cases(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type text not null check (actor_type in ('client','consultant','system')),
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists diagnostic_audit_logs_case_idx on public.diagnostic_audit_logs (case_id, created_at desc);
create index if not exists diagnostic_audit_logs_action_idx on public.diagnostic_audit_logs (action, created_at desc);

create table if not exists public.diagnostic_rate_limits (
  id uuid primary key default gen_random_uuid(),
  identifier_hash text not null,
  action text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  created_at timestamptz not null default now(),
  unique (identifier_hash, action, window_started_at)
);
create index if not exists diagnostic_rate_limits_cleanup_idx on public.diagnostic_rate_limits (window_started_at);

create table if not exists public.diagnostic_report_tokens (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.diagnostic_cases(id) on delete cascade,
  review_id uuid not null references public.diagnostic_reviews(id) on delete restrict,
  token_hash text not null unique check (char_length(token_hash) = 64),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists diagnostic_report_tokens_case_idx on public.diagnostic_report_tokens (case_id, expires_at desc);

create or replace function diagnostic_private.diagnostic_reject_immutable_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'diagnostic immutable record cannot be modified';
end;
$$;

drop trigger if exists diagnostic_submissions_immutable on public.diagnostic_submissions;
create trigger diagnostic_submissions_immutable before update or delete on public.diagnostic_submissions
for each row execute function diagnostic_private.diagnostic_reject_immutable_change();
drop trigger if exists diagnostic_review_versions_immutable on public.diagnostic_review_versions;
create trigger diagnostic_review_versions_immutable before update or delete on public.diagnostic_review_versions
for each row execute function diagnostic_private.diagnostic_reject_immutable_change();
drop trigger if exists diagnostic_audit_logs_immutable on public.diagnostic_audit_logs;
create trigger diagnostic_audit_logs_immutable before update or delete on public.diagnostic_audit_logs
for each row execute function diagnostic_private.diagnostic_reject_immutable_change();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'diagnostic_consultants','diagnostic_clients','diagnostic_cases','diagnostic_access_tokens',
    'diagnostic_answers','diagnostic_consents','diagnostic_submissions','diagnostic_ai_assessments',
    'diagnostic_reviews','diagnostic_review_versions','diagnostic_email_templates',
    'diagnostic_email_deliveries','diagnostic_content_recommendations','diagnostic_status_history',
    'diagnostic_audit_logs','diagnostic_rate_limits','diagnostic_report_tokens'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon', table_name);
  end loop;
end $$;

grant select on public.diagnostic_consultants, public.diagnostic_clients, public.diagnostic_cases,
  public.diagnostic_answers, public.diagnostic_consents, public.diagnostic_submissions,
  public.diagnostic_ai_assessments, public.diagnostic_reviews, public.diagnostic_review_versions,
  public.diagnostic_email_templates, public.diagnostic_email_deliveries,
  public.diagnostic_content_recommendations, public.diagnostic_status_history,
  public.diagnostic_audit_logs to authenticated;
grant insert, update on public.diagnostic_reviews to authenticated;
grant insert, update on public.diagnostic_email_templates, public.diagnostic_content_recommendations to authenticated;
grant all on public.diagnostic_consultants, public.diagnostic_clients, public.diagnostic_cases,
  public.diagnostic_access_tokens, public.diagnostic_answers, public.diagnostic_consents,
  public.diagnostic_submissions, public.diagnostic_ai_assessments, public.diagnostic_reviews,
  public.diagnostic_review_versions, public.diagnostic_email_templates,
  public.diagnostic_email_deliveries, public.diagnostic_content_recommendations,
  public.diagnostic_status_history, public.diagnostic_audit_logs,
  public.diagnostic_rate_limits, public.diagnostic_report_tokens to service_role;

drop policy if exists diagnostic_consultants_self_select on public.diagnostic_consultants;
create policy diagnostic_consultants_self_select on public.diagnostic_consultants for select to authenticated
using (user_id = (select auth.uid()) and active = true);
drop policy if exists diagnostic_consultants_admin_insert on public.diagnostic_consultants;
create policy diagnostic_consultants_admin_insert on public.diagnostic_consultants for insert to authenticated
with check ((select diagnostic_private.diagnostic_is_admin()));
drop policy if exists diagnostic_consultants_admin_update on public.diagnostic_consultants;
create policy diagnostic_consultants_admin_update on public.diagnostic_consultants for update to authenticated
using ((select diagnostic_private.diagnostic_is_admin()))
with check ((select diagnostic_private.diagnostic_is_admin()));

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'diagnostic_clients','diagnostic_cases','diagnostic_answers','diagnostic_consents',
    'diagnostic_submissions','diagnostic_ai_assessments','diagnostic_reviews',
    'diagnostic_review_versions','diagnostic_email_templates','diagnostic_email_deliveries',
    'diagnostic_content_recommendations','diagnostic_status_history','diagnostic_audit_logs'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_consultant_select', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select diagnostic_private.diagnostic_is_consultant()))',
      table_name || '_consultant_select', table_name
    );
  end loop;
end $$;

drop policy if exists diagnostic_reviews_consultant_insert on public.diagnostic_reviews;
create policy diagnostic_reviews_consultant_insert on public.diagnostic_reviews for insert to authenticated
with check ((select diagnostic_private.diagnostic_is_consultant()) and consultant_id = (select auth.uid()));
drop policy if exists diagnostic_reviews_consultant_update on public.diagnostic_reviews;
create policy diagnostic_reviews_consultant_update on public.diagnostic_reviews for update to authenticated
using ((select diagnostic_private.diagnostic_is_consultant()) and consultant_id = (select auth.uid()))
with check ((select diagnostic_private.diagnostic_is_consultant()) and consultant_id = (select auth.uid()));
drop policy if exists diagnostic_email_templates_admin_insert on public.diagnostic_email_templates;
create policy diagnostic_email_templates_admin_insert on public.diagnostic_email_templates for insert to authenticated
with check ((select diagnostic_private.diagnostic_is_admin()));
drop policy if exists diagnostic_email_templates_admin_update on public.diagnostic_email_templates;
create policy diagnostic_email_templates_admin_update on public.diagnostic_email_templates for update to authenticated
using ((select diagnostic_private.diagnostic_is_admin())) with check ((select diagnostic_private.diagnostic_is_admin()));
drop policy if exists diagnostic_content_admin_insert on public.diagnostic_content_recommendations;
create policy diagnostic_content_admin_insert on public.diagnostic_content_recommendations for insert to authenticated
with check ((select diagnostic_private.diagnostic_is_admin()));
drop policy if exists diagnostic_content_admin_update on public.diagnostic_content_recommendations;
create policy diagnostic_content_admin_update on public.diagnostic_content_recommendations for update to authenticated
using ((select diagnostic_private.diagnostic_is_admin())) with check ((select diagnostic_private.diagnostic_is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('diagnostic_reports', 'diagnostic_reports', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists diagnostic_reports_consultant_select on storage.objects;
create policy diagnostic_reports_consultant_select on storage.objects for select to authenticated
using (bucket_id = 'diagnostic_reports' and (select diagnostic_private.diagnostic_is_consultant()));
drop policy if exists diagnostic_reports_consultant_insert on storage.objects;
create policy diagnostic_reports_consultant_insert on storage.objects for insert to authenticated
with check (bucket_id = 'diagnostic_reports' and (select diagnostic_private.diagnostic_is_consultant()));
drop policy if exists diagnostic_reports_consultant_update on storage.objects;
create policy diagnostic_reports_consultant_update on storage.objects for update to authenticated
using (bucket_id = 'diagnostic_reports' and (select diagnostic_private.diagnostic_is_consultant()))
with check (bucket_id = 'diagnostic_reports' and (select diagnostic_private.diagnostic_is_consultant()));

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'diagnostic_consultants','diagnostic_clients','diagnostic_cases','diagnostic_answers',
    'diagnostic_reviews','diagnostic_email_templates','diagnostic_content_recommendations'
  ] loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_set_updated_at', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function diagnostic_private.diagnostic_set_updated_at()',
      table_name || '_set_updated_at', table_name
    );
  end loop;
end $$;

insert into public.diagnostic_email_templates (template_key, name, subject, body, active)
values
  ('information_request', 'Solicitação de informação', 'Precisamos de uma informação para o seu simulador', 'Olá, {{nome}}.\n\nPara continuarmos a análise do simulador {{diagnostico}}, precisamos confirmar:\n\n{{mensagem}}\n\nEquipe Canadá Sem Filtro', true),
  ('final_delivery', 'Entrega final', 'O resultado do seu Simulador Canadá Sem Filtro está pronto', 'Olá, {{nome}}.\n\nConcluímos a revisão profissional do simulador {{diagnostico}}.\n\nEquipe Canadá Sem Filtro', true)
on conflict (template_key) do nothing;

insert into public.diagnostic_content_recommendations (title, description, url, tags)
values
  ('Diário de Bordo — Primeiros Passos', 'Conteúdo introdutório para organizar objetivo, prazo e orçamento.', 'https://www.canadasemfiltro.ca/', array['planejamento','inicio']),
  ('Mapa de Cidades Canadenses', 'Critérios para comparar custo, trabalho, clima e estilo de vida.', 'https://www.canadasemfiltro.ca/', array['cidades','regioes'])
on conflict do nothing;

create unique index if not exists diagnostic_content_title_idx on public.diagnostic_content_recommendations (title);

do $$
declare
  demo_client_id uuid;
  demo_case_id uuid;
  demo_submission_id uuid;
begin
  insert into public.diagnostic_clients (full_name, email_normalized, email_display, source)
  values ('Pessoa Demonstração', 'pessoa.demo@example.invalid', 'pessoa.demo@example.invalid', 'demo')
  on conflict (email_normalized) do update set full_name = excluded.full_name
  returning id into demo_client_id;

  insert into public.diagnostic_cases (case_number, client_id, status, objective, submitted_at, source_metadata)
  values ('CSF-DEMO-0001', demo_client_id, 'awaiting_triage', 'Trabalhar', now() - interval '2 days', '{"demo":true}'::jsonb)
  on conflict (case_number) do update set objective = excluded.objective
  returning id into demo_case_id;

  insert into public.diagnostic_submissions (case_id, answers_snapshot, schema_version, consent_snapshot, idempotency_key, submitted_at)
  values (
    demo_case_id,
    '{"age":34,"nationality":"Brasileira","country_of_residence":"Brasil","marital_status":"Solteiro(a)","has_children":"Não","main_objective":"Trabalhar","education_level":"Graduação","education_field":"Tecnologia","graduation_year":2014,"education_outside_canada":"Sim","current_profession":"Analista de dados","experience_years":8,"leadership_experience":"Sim","regulated_profession":"Não","canadian_work_experience":"Não","english_level":"Avançado","english_test":"Não","french_level":"Básico","french_test":"Não","french_investment":"Sim","available_funds":45000,"funds_currency":"BRL","funds_scope":"Parcialmente","sell_assets":"Não","financial_support":"Não","canadian_authorization":"Não","has_refusal":"Não","lived_in_canada":"Não","family_in_canada":"Não","overstay":"Não","admissibility_issue":"Não","life_priorities":["Empregabilidade","Qualidade de vida"],"city_size":"Média","location_preference":"Aberta a diferentes regiões","outside_major_cities":"Sim","family_must_haves":"Segurança e acesso a transporte","project_timeline":"De 1 a 2 anos","willing_to_delay":"Sim","career_change":"Talvez","smaller_regions":"Sim","biggest_challenge":"Organizar recursos e validar o mercado","difficulty_factors":["Recursos financeiros"],"main_question":"Como priorizar a preparação?"}'::jsonb,
    1,
    '{"granted":true,"policyVersion":"demo"}'::jsonb,
    '00000000-0000-4000-8000-000000000001'::uuid,
    now() - interval '2 days'
  ) on conflict (case_id, idempotency_key) do nothing;
  select id into demo_submission_id
  from public.diagnostic_submissions
  where case_id = demo_case_id and idempotency_key = '00000000-0000-4000-8000-000000000001'::uuid;

  insert into public.diagnostic_ai_assessments (case_id, submission_id, version, status, methodology_version, model, structured_result, confidence, completed_at)
  values (
    demo_case_id, demo_submission_id, 1, 'completed', '1.0.0', 'demo/structured-assessment',
    '{"overallScore":68,"scoreExplanation":"Boa base profissional e flexibilidade; idioma oficial e reserva precisam de planejamento.","readinessLevel":"intermediario","scoreComponents":[],"strengths":["Experiência profissional consistente","Flexibilidade regional","Prazo realista"],"risks":["Reserva ainda limitada","Ausência de prova oficial de idioma"],"missingOrContradictory":[],"priorities":{"threeMonths":["Mapear mercado de trabalho","Planejar prova de inglês"],"sixMonths":["Realizar teste oficial","Ampliar reserva"],"twelveMonths":["Validar estratégia com profissional","Organizar documentação"]},"regionalCompatibility":["Cidades médias com setor de tecnologia"],"cityTypes":["Cidades médias"],"initialInvestmentRange":"Requer validação conforme estratégia","recommendedReserve":"Construir reserva separada de emergência","preparationTimeEstimate":"12 a 18 meses","recommendedContent":["Mapa de Cidades Canadenses"],"technicalAlerts":[],"followUpQuestions":["Qual é a disponibilidade mensal para poupança?"],"executiveSummary":"Perfil com base profissional consistente e boa flexibilidade, ainda em fase de transformar intenção em plano documentado.","confidence":0.82,"methodologyVersion":"1.0.0","promptVersion":"demo","model":"demo/structured-assessment"}'::jsonb,
    0.82, now() - interval '1 day'
  ) on conflict (case_id, version) do nothing;
end $$;
