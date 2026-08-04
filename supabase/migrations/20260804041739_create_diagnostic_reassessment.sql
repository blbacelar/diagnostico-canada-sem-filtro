create or replace function public.create_diagnostic_reassessment(
  p_source_case_id uuid,
  p_consultant_id uuid,
  p_case_number text,
  p_token_hash text,
  p_token_expires_at timestamptz
)
returns table (id uuid, case_number text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_case public.diagnostic_cases%rowtype;
  created_case_id uuid := gen_random_uuid();
  copied_objective text;
  copied_answer_count integer;
begin
  if not exists (
    select 1
    from public.diagnostic_consultants
    where user_id = p_consultant_id
      and active = true
  ) then
    raise exception 'A conta informada não possui acesso ativo ao dashboard.' using errcode = '42501';
  end if;

  select *
  into source_case
  from public.diagnostic_cases
  where diagnostic_cases.id = p_source_case_id
    and archived_at is null
  for share;

  if not found then
    raise exception 'Diagnóstico de origem não encontrado.' using errcode = 'P0002';
  end if;

  if source_case.status <> 'sent' then
    raise exception 'Somente um diagnóstico já enviado pode originar uma nova avaliação.' using errcode = 'P0001';
  end if;

  select answer #>> '{}'
  into copied_objective
  from public.diagnostic_answers
  where diagnostic_answers.case_id = source_case.id
    and question_key = 'main_objective'
  limit 1;

  insert into public.diagnostic_cases (
    id,
    case_number,
    client_id,
    status,
    objective,
    source_metadata
  ) values (
    created_case_id,
    p_case_number,
    source_case.client_id,
    'client_draft',
    coalesce(nullif(source_case.objective, ''), nullif(copied_objective, '')),
    jsonb_build_object(
      'source', 'consultant_reassessment',
      'copied_from_case_id', source_case.id,
      'created_by_consultant_id', p_consultant_id
    )
  );

  insert into public.diagnostic_answers (
    case_id,
    section_key,
    question_key,
    answer,
    schema_version
  )
  select
    created_case_id,
    section_key,
    question_key,
    answer,
    schema_version
  from public.diagnostic_answers
  where diagnostic_answers.case_id = source_case.id;

  get diagnostics copied_answer_count = row_count;
  if copied_answer_count = 0 then
    raise exception 'O diagnóstico enviado não possui respostas para reutilizar.' using errcode = 'P0002';
  end if;

  insert into public.diagnostic_access_tokens (
    case_id,
    token_hash,
    expires_at
  ) values (
    created_case_id,
    p_token_hash,
    p_token_expires_at
  );

  insert into public.diagnostic_status_history (
    case_id,
    from_status,
    to_status,
    actor_type,
    actor_user_id,
    note
  ) values (
    created_case_id,
    null,
    'client_draft',
    'consultant',
    p_consultant_id,
    format('Novo diagnóstico criado a partir de %s com respostas editáveis.', source_case.case_number)
  );

  insert into public.diagnostic_audit_logs (
    case_id,
    actor_user_id,
    actor_type,
    action,
    metadata
  ) values (
    created_case_id,
    p_consultant_id,
    'consultant',
    'diagnostic.reassessment_created',
    jsonb_build_object('sourceCaseId', source_case.id, 'sourceCaseNumber', source_case.case_number)
  );

  return query select created_case_id, p_case_number;
end;
$$;

revoke all on function public.create_diagnostic_reassessment(uuid, uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.create_diagnostic_reassessment(uuid, uuid, text, text, timestamptz) to service_role;
