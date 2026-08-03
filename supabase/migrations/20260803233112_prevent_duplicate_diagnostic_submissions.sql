-- A diagnostic case produces one immutable submission snapshot. The API still
-- supports idempotent retries, while PostgreSQL closes concurrent-request races.
create unique index if not exists diagnostic_submissions_one_per_case_idx
  on public.diagnostic_submissions (case_id);
