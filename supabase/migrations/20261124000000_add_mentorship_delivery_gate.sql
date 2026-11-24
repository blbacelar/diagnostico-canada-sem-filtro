begin;

alter table public.diagnostic_cases
  add column if not exists mentorship_consultation_scheduled_at timestamp with time zone;

comment on column public.diagnostic_cases.mentorship_consultation_scheduled_at is
  'Momento em que a consulta one-on-one da Mentoria foi marcada. Libera a entrega do Simulador para clientes da Mentoria.';

create index if not exists diagnostic_cases_mentorship_delivery_idx
  on public.diagnostic_cases (mentorship_consultation_scheduled_at, updated_at asc)
  where status = 'approved' and mentorship_consultation_scheduled_at is not null;

commit;
