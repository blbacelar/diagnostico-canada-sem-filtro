-- Unifica o cadastro do CRM e do App de Simulador em public.clients.
-- A tabela diagnostic_clients é preservada como legado somente para auditoria;
-- nenhuma nova leitura ou escrita da aplicação deve usá-la.

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  email text not null check (email = lower(trim(email))),
  phone text,
  document text,
  country text,
  zip_code text,
  city text,
  state text,
  address text,
  district text,
  number text,
  complement text,
  status_journey text not null default 'lead',
  is_overdue boolean not null default false,
  assigned_consultant_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clients add column if not exists source text not null default 'diagnostic';
insert into public.clients (id, name, email, source, created_at, updated_at)
select id, full_name, email_normalized, source, created_at, updated_at
from public.diagnostic_clients
on conflict (email) do update
set name = excluded.name,
    updated_at = greatest(public.clients.updated_at, excluded.updated_at);

alter table public.clients add column if not exists phone text;
alter table public.clients add column if not exists document text;
alter table public.clients add column if not exists country text;
alter table public.clients add column if not exists zip_code text;
alter table public.clients add column if not exists city text;
alter table public.clients add column if not exists state text;
alter table public.clients add column if not exists address text;
alter table public.clients add column if not exists district text;
alter table public.clients add column if not exists number text;
alter table public.clients add column if not exists complement text;
alter table public.clients add column if not exists status_journey text not null default 'lead';
alter table public.clients add column if not exists is_overdue boolean not null default false;
alter table public.clients add column if not exists assigned_consultant_id uuid;
alter table public.clients add column if not exists created_at timestamptz not null default now();
alter table public.clients add column if not exists updated_at timestamptz not null default now();

update public.clients
set email = lower(trim(email)), updated_at = coalesce(updated_at, now())
where email <> lower(trim(email));
alter table public.clients drop constraint if exists clients_email_normalized_check;
alter table public.clients add constraint clients_email_normalized_check check (email = lower(trim(email)));
alter table public.clients alter column name set not null;
alter table public.clients alter column email set not null;
create unique index if not exists clients_email_normalized_key on public.clients (email);
create index if not exists clients_status_journey_idx on public.clients (status_journey, updated_at desc);

alter table public.diagnostic_cases add column if not exists central_client_id uuid;
update public.diagnostic_cases as diagnostic_case
set central_client_id = client.id
from public.diagnostic_clients as legacy_client
join public.clients as client on client.email = legacy_client.email_normalized
where diagnostic_case.client_id = legacy_client.id
  and diagnostic_case.central_client_id is null;

do $$
begin
  if exists (select 1 from public.diagnostic_cases where central_client_id is null) then
    raise exception 'Não foi possível relacionar todos os casos de simulador a public.clients';
  end if;
end $$;

alter table public.diagnostic_cases drop constraint if exists diagnostic_cases_client_id_fkey;
drop index if exists public.diagnostic_cases_client_id_idx;
alter table public.diagnostic_cases drop column client_id;
alter table public.diagnostic_cases rename column central_client_id to client_id;
alter table public.diagnostic_cases
  add constraint diagnostic_cases_client_id_fkey foreign key (client_id)
  references public.clients(id) on delete restrict;
create index diagnostic_cases_client_id_idx on public.diagnostic_cases (client_id);

alter table public.diagnostic_clients rename to diagnostic_clients_legacy;
revoke all on public.diagnostic_clients_legacy from anon, authenticated;
drop policy if exists diagnostic_clients_consultant_select on public.diagnostic_clients_legacy;

alter table public.clients enable row level security;
drop policy if exists clients_consultant_select on public.clients;
create policy clients_consultant_select on public.clients
  for select to authenticated using ((select diagnostic_private.diagnostic_is_consultant()));
drop policy if exists clients_consultant_insert on public.clients;
create policy clients_consultant_insert on public.clients
  for insert to authenticated
  with check ((select diagnostic_private.diagnostic_is_consultant()) and email = lower(trim(email)));
drop policy if exists clients_consultant_update on public.clients;
create policy clients_consultant_update on public.clients
  for update to authenticated
  using ((select diagnostic_private.diagnostic_is_consultant()))
  with check ((select diagnostic_private.diagnostic_is_consultant()) and email = lower(trim(email)));
revoke all on public.clients from anon;
grant select, insert, update on public.clients to authenticated;
grant all on public.clients to service_role;

alter table public.purchases enable row level security;
create unique index if not exists purchases_transaction_code_key on public.purchases (transaction_code);
