-- Associação explícita entre identidade autenticada e cadastro comercial.
-- Candidata para revisão: não cria associações nem altera dados existentes.
create table public.csf_diagnostic_user_links (
  auth_user_id uuid primary key references auth.users(id) on delete restrict,
  client_id uuid not null unique references public.clients(id) on delete restrict,
  linked_at timestamptz not null default now()
);

alter table public.csf_diagnostic_user_links enable row level security;
revoke all on public.csf_diagnostic_user_links from public, anon, authenticated;
grant select, insert on public.csf_diagnostic_user_links to service_role;

create table public.csf_diagnostic_link_challenges (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  code_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz
);
alter table public.csf_diagnostic_link_challenges enable row level security;
revoke all on public.csf_diagnostic_link_challenges from public, anon, authenticated;
grant select, insert, update on public.csf_diagnostic_link_challenges to service_role;
