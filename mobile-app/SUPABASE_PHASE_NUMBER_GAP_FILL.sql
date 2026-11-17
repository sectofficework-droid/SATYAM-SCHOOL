-- REQ-FEAT-021 follow-up (2026-11-17) - user: "make sure if any batch
-- deleted then next batch should continue from where it is not used not
-- like a unique number we are not giving enrollment number here."
--
-- phase_number previously defaulted to nextval() on a plain sequence,
-- which (correctly, for a sequence) never reuses a number once deleted -
-- that produced the "Batch 20 right after Batch 5" gap. Batch numbers are
-- meant to be a tidy display counter, not a permanent unique id like an
-- enrollment number, so switch the default to always pick the smallest
-- currently-unused positive integer - deleting a batch frees its number
-- for the very next one created.
--
-- pg_advisory_xact_lock guards against two concurrent batch creations
-- picking the same gap before either commits (the UNIQUE(phase_number)
-- constraint would otherwise fail one of them) - cheap insurance, not
-- meaningfully different in spirit from the rest of this function.
--
-- Applied live via Supabase MCP on 2026-11-17. Verified by inserting a
-- test row (got phase_number 7, correctly after existing 1-6), deleting
-- it, inserting again (got 7 again, proving reuse), then deleting that
-- test row too - no test data left in production.
create or replace function public.next_student_import_phase_number()
returns integer
language plpgsql
as $$
declare
  next_num integer;
begin
  perform pg_advisory_xact_lock(hashtext('student_import_phases_phase_number'));
  select min(candidate) into next_num
  from generate_series(1, (select coalesce(max(phase_number), 0) from student_import_phases) + 1) as candidate
  where candidate not in (select phase_number from student_import_phases);
  return next_num;
end;
$$;

alter table public.student_import_phases alter column phase_number drop default;
alter table public.student_import_phases alter column phase_number set default public.next_student_import_phase_number();
