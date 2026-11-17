-- REQ-FEAT-023 - Document Collection Follow-up Tracker (call log) on Students Documents page.
-- One record per student (latest-state only) tracking call/reply/promised-date/status
-- for document collection follow-up. See governance/planning/TODO.md REQ-FEAT-023.
-- Applied live via Supabase MCP on 2026-11-17.

create table if not exists public.student_document_followups (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students(id) on delete cascade,
  status        text not null default 'Not Called'
                  check (status in ('Not Called', 'Called', 'Date Promised', 'Submitted', 'Uploaded')),
  reply_note    text,
  promised_date date,
  updated_by    uuid references public.admin_users(id),
  updated_at    timestamptz not null default now(),
  unique (student_id)
);

alter table public.student_document_followups enable row level security;

create policy "admin staff manage student_document_followups"
  on public.student_document_followups
  for all
  using (is_admin_user())
  with check (is_admin_user());

grant select, insert, update, delete on public.student_document_followups to authenticated, service_role;
