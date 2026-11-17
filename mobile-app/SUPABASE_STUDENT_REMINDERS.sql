-- REQ-FEAT-025 - Recurring reminder/call-back system: overdue Follow-up
-- promised dates + manual reminders from the Note popover, nagging via a
-- popup across the whole admin panel until dismissed (session-only, no DB
-- write) or resolved (permanent). One row per student (latest-state only).
-- See governance/planning/TODO.md REQ-FEAT-025.
-- Applied live via Supabase MCP on 2026-11-17.

create table if not exists public.student_reminders (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  status      text not null default 'active' check (status in ('active', 'resolved')),
  message     text,
  resolved_at timestamptz,
  resolved_by uuid references public.admin_users(id),
  updated_by  uuid references public.admin_users(id),
  updated_at  timestamptz not null default now(),
  unique (student_id)
);

alter table public.student_reminders enable row level security;

create policy "admin staff manage student_reminders"
  on public.student_reminders
  for all
  using (is_admin_user())
  with check (is_admin_user());

grant select, insert, update, delete on public.student_reminders to authenticated, service_role;
