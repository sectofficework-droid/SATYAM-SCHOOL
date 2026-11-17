-- REQ-FEAT-024 - General-purpose Admin Note per student, shared across the
-- Student list, Government Entry, Documents, and Student Report pages.
-- One record per student (latest-state only), plain free text.
-- See governance/planning/TODO.md REQ-FEAT-024.
-- Applied live via Supabase MCP on 2026-11-17.

create table if not exists public.student_admin_notes (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  note        text,
  updated_by  uuid references public.admin_users(id),
  updated_at  timestamptz not null default now(),
  unique (student_id)
);

alter table public.student_admin_notes enable row level security;

create policy "admin staff manage student_admin_notes"
  on public.student_admin_notes
  for all
  using (is_admin_user())
  with check (is_admin_user());

grant select, insert, update, delete on public.student_admin_notes to authenticated, service_role;
