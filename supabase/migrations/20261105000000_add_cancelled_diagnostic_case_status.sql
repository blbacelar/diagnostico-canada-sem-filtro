-- Preserve cancelled simulators and their history without allowing them to
-- re-enter review or delivery workflows.
alter table public.diagnostic_cases
  drop constraint if exists diagnostic_cases_status_check;

alter table public.diagnostic_cases
  add constraint diagnostic_cases_status_check
  check (status in (
    'client_draft',
    'submitted',
    'ai_processing',
    'awaiting_triage',
    'in_review',
    'awaiting_client',
    'ready_for_approval',
    'approved',
    'sending',
    'sent',
    'processing_error',
    'cancelled',
    'archived'
  ));
